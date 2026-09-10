/**
 * 本地加密 Vault - 调用 Rust 端 AES-256-GCM
 *
 * 能力：
 *  - 文本加密 / 解密（剪贴板密文、校验串）
 *  - 文件加密 / 解密（.md ↔ .md.vault）
 *  - **保存时自动加密**：工作区加密启用后，保存直接把密文落盘（磁盘零明文）
 *  - **打开时自动识别**：首 4 字节为 MWV1 即视为密文，弹窗输入主密码后解密
 *
 * 安全约定：
 *  - 主密码只作为参数传给 Rust；**仅驻留内存**，绝不写 localStorage / sessionStorage，绝不打印日志
 *  - 校验用 verifier 密文存于 Rust 侧 setting（SQLite），渲染进程 XSS 无法读取
 *  - 会话密码在 `lock()` / 应用退出后即失效
 */
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { useWorkspaceStore } from '../stores/workspace'

const VERIFIER_PLAIN = 'mw-vault-ok'
const VERIFIER_KEY = 'vaultVerifier'

/* ---------- 模块级状态（所有调用方共享同一份会话状态） ---------- */

/** 工作区加密是否已启用（Rust 侧存在 verifier） */
const enabled = ref(false)
/** 本次会话是否已解锁（内存中持有可用密码） */
const unlocked = ref(false)
/** 会话密码：仅驻内存 */
let sessionPassword: string | null = null

export interface UnlockRequest {
  title: string
  hint?: string
}

/** 待用户输入密码的请求（由 VaultUnlockDialog 渲染） */
const unlockRequest = ref<UnlockRequest | null>(null)
let unlockResolve: ((pw: string | null) => void) | null = null

/** 由解锁弹窗提交密码 */
export function submitUnlockPassword(pw: string) {
  const resolve = unlockResolve
  unlockResolve = null
  unlockRequest.value = null
  resolve?.(pw)
}

/** 由解锁弹窗取消 */
export function cancelUnlock() {
  const resolve = unlockResolve
  unlockResolve = null
  unlockRequest.value = null
  resolve?.(null)
}

/** 只读状态（给组件用） */
export function useVaultState() {
  return { enabled, unlocked, unlockRequest }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function useVault() {
  const ws = useWorkspaceStore()

  async function encryptText(plain: string, password: string): Promise<string> {
    return invoke<string>('encrypt_text', { plaintext: plain, password })
  }

  async function decryptText(ct: string, password: string): Promise<string> {
    return invoke<string>('decrypt_text', { ciphertextB64: ct, password })
  }

  async function encryptFile(src: string, dst: string, password: string): Promise<void> {
    return invoke('encrypt_file', { src, dst, password })
  }

  async function decryptFile(src: string, password: string): Promise<Uint8Array> {
    return invoke<number[]>('decrypt_file', { src, password }).then((arr) => new Uint8Array(arr))
  }

  async function backup(src: string): Promise<string | null> {
    if (!ws.rootPath) return null
    try {
      const backupDir = `${ws.rootPath.replace(/\\/g, '/')}/.backup`
      return invoke<string>('backup_file', { src, backupDir })
    } catch (e) {
      console.warn('backup failed', e)
      return null
    }
  }

  /**
   * 设置主密码：只把「用该密码加密的校验串」持久化到 Rust setting，
   * 密码本身不落任何可读存储。设置成功即视为本次会话已解锁。
   */
  async function setMasterPassword(password: string): Promise<void> {
    const verifier = await invoke<string>('encrypt_text', {
      plaintext: VERIFIER_PLAIN,
      password,
    })
    await invoke('set_setting', { key: VERIFIER_KEY, value: verifier })
    enabled.value = true
    sessionPassword = password
    unlocked.value = true
  }

  /** 校验主密码：用 verifier 密文尝试解密，成功且内容匹配才算通过 */
  async function verifyMasterPassword(password: string): Promise<boolean> {
    const verifier = await invoke<string | null>('get_setting', { key: VERIFIER_KEY })
    if (!verifier) return false
    try {
      const out = await invoke<string>('decrypt_text', {
        ciphertextB64: verifier,
        password,
      })
      return out === VERIFIER_PLAIN
    } catch {
      return false
    }
  }

  /** 是否已设置过主密码 */
  async function hasMasterPassword(): Promise<boolean> {
    const verifier = await invoke<string | null>('get_setting', { key: VERIFIER_KEY })
    return !!verifier
  }

  /** 从 Rust 侧同步「工作区加密是否启用」 */
  async function refreshEnabled(): Promise<boolean> {
    try {
      enabled.value = await hasMasterPassword()
    } catch {
      enabled.value = false
    }
    return enabled.value
  }

  /** 用主密码解锁本次会话（密码仅存内存） */
  async function unlock(password: string): Promise<boolean> {
    if (!(await verifyMasterPassword(password))) return false
    sessionPassword = password
    unlocked.value = true
    return true
  }

  /** 锁定：清除内存中的会话密码 */
  function lock() {
    sessionPassword = null
    unlocked.value = false
  }

  /** 弹出密码框，等待用户输入（取消返回 null） */
  function requestPassword(req: UnlockRequest): Promise<string | null> {
    // 同一时刻只允许一个待处理请求，旧的按取消处理
    if (unlockResolve) {
      const prev = unlockResolve
      unlockResolve = null
      prev(null)
    }
    unlockRequest.value = req
    return new Promise<string | null>((resolve) => {
      unlockResolve = resolve
    })
  }

  /** 确保拿到一个可用的会话密码（无则弹窗并校验） */
  async function ensurePassword(title: string, hint?: string): Promise<string | null> {
    if (sessionPassword) return sessionPassword
    const input = await requestPassword({ title, hint })
    if (!input) return null
    if (!(await verifyMasterPassword(input))) return null
    sessionPassword = input
    unlocked.value = true
    return input
  }

  /**
   * 读取文档：自动识别密文并解密。
   * @param reader 明文读取器（默认 fs 插件 readTextFile；关联打开场景可传 Rust 直读）
   */
  async function readDocument(
    path: string,
    reader?: (p: string) => Promise<string>,
  ): Promise<string> {
    const encrypted = await invoke<boolean>('is_encrypted_file', { path }).catch(() => false)
    const readPlain = reader ?? ((p: string) => readTextFile(p))
    if (!encrypted) return readPlain(path)

    if (sessionPassword) {
      try {
        return decodeUtf8(await decryptFile(path, sessionPassword))
      } catch {
        // 会话密码已失效（换过主密码等），继续走弹窗
        sessionPassword = null
        unlocked.value = false
      }
    }
    const pw = await requestPassword({ title: '输入主密码以打开加密文件', hint: path })
    if (!pw) throw new Error('已取消：加密文件需要主密码')
    if (!(await verifyMasterPassword(pw))) throw new Error('主密码错误')
    sessionPassword = pw
    unlocked.value = true
    return decodeUtf8(await decryptFile(path, pw))
  }

  /**
   * 写入文档：启用工作区加密时**直接把密文落盘**（磁盘上不会出现明文）。
   * 未启用则按普通文本写入。
   */
  async function writeDocument(path: string, text: string): Promise<void> {
    if (!enabled.value) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(path, text)
      return
    }
    const pw = await ensurePassword('输入主密码以加密保存', path)
    if (!pw) throw new Error('已取消：未解锁无法加密保存')
    await invoke('write_encrypted_text', { path, plaintext: text, password: pw })
  }

  /** 把一个已存在的明文文件就地加密 */
  async function encryptFileInPlace(path: string): Promise<void> {
    const pw = await ensurePassword('输入主密码以加密该文件', path)
    if (!pw) throw new Error('已取消：未解锁无法加密')
    await invoke('encrypt_file_in_place', { path, password: pw })
  }

  /** 当前是否具备「直接写入」的条件：未启用加密，或已解锁 */
  function canWriteNow(): boolean {
    return !enabled.value || !!sessionPassword
  }

  /**
   * 静默写入：**不弹密码框**。
   * 供自动保存 / 退出保存使用 —— 加密已启用但未解锁时返回 false，由调用方决定后续（不阻塞用户）。
   */
  async function writeDocumentQuiet(path: string, text: string): Promise<boolean> {
    if (!enabled.value) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(path, text)
      return true
    }
    if (!sessionPassword) return false
    await invoke('write_encrypted_text', { path, plaintext: text, password: sessionPassword })
    return true
  }

  /** 是否为密文文件 */
  async function isEncrypted(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('is_encrypted_file', { path })
    } catch {
      return false
    }
  }

  return {
    encryptText,
    decryptText,
    encryptFile,
    decryptFile,
    backup,
    setMasterPassword,
    verifyMasterPassword,
    hasMasterPassword,
    refreshEnabled,
    unlock,
    lock,
    requestPassword,
    ensurePassword,
    readDocument,
    writeDocument,
    writeDocumentQuiet,
    canWriteNow,
    encryptFileInPlace,
    isEncrypted,
  }
}
