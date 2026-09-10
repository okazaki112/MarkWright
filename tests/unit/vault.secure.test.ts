import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVault } from '../../src/composables/useVault'
import { getTauri } from '../setup'

let settings: Record<string, string>
let sealedWrites: { path: string; plaintext: string; password: string }[]
let encryptedFiles: Set<string>

beforeEach(() => {
  setActivePinia(createPinia())
  settings = {}
  sealedWrites = []
  encryptedFiles = new Set()
  const tauri = getTauri()
  tauri.invoke.mockImplementation(async (cmd: string, args: any) => {
    if (cmd === 'encrypt_text') return 'enc:' + args.plaintext + '|' + args.password
    if (cmd === 'decrypt_text') {
      const [pt, pw] = String(args.ciphertextB64).slice(4).split('|')
      if (pw !== args.password) throw new Error('bad password')
      return pt
    }
    if (cmd === 'set_setting') {
      settings[args.key] = args.value
      return undefined
    }
    if (cmd === 'get_setting') return settings[args.key] ?? null
    if (cmd === 'write_encrypted_text') {
      sealedWrites.push({ path: args.path, plaintext: args.plaintext, password: args.password })
      return undefined
    }
    if (cmd === 'is_encrypted_file') return encryptedFiles.has(args.path)
    if (cmd === 'decrypt_file') return Array.from(new TextEncoder().encode('# 解密后的正文'))
    return undefined
  })
})

describe('useVault · 保存时自动加密', () => {
  it('未启用加密时按明文写入，且不调用加密命令', async () => {
    const tauri = getTauri()
    const v = useVault()
    await v.refreshEnabled()
    expect(v.canWriteNow()).toBe(true)

    await v.writeDocument('/vault/a.md', '# 明文')
    expect(tauri.writeTextFile).toHaveBeenCalledWith('/vault/a.md', '# 明文')
    expect(sealedWrites).toHaveLength(0)
  })

  it('启用并解锁后，保存直接落盘密文（磁盘零明文）', async () => {
    const tauri = getTauri()
    const v = useVault()
    await v.setMasterPassword('pw123456')
    expect(v.canWriteNow()).toBe(true)

    await v.writeDocument('/vault/a.md', '# 机密正文')
    expect(sealedWrites).toHaveLength(1)
    expect(sealedWrites[0]).toMatchObject({
      path: '/vault/a.md',
      plaintext: '# 机密正文',
      password: 'pw123456',
    })
    // 关键：绝不能再写一次明文
    expect(tauri.writeTextFile).not.toHaveBeenCalled()
  })

  it('启用但未解锁时，静默写入放弃（不落盘、不弹窗）', async () => {
    const tauri = getTauri()
    const v = useVault()
    await v.setMasterPassword('pw123456')
    v.lock()
    expect(v.canWriteNow()).toBe(false)

    const ok = await v.writeDocumentQuiet('/vault/a.md', '# 草稿')
    expect(ok).toBe(false)
    expect(sealedWrites).toHaveLength(0)
    expect(tauri.writeTextFile).not.toHaveBeenCalled()
  })

  it('锁定后重新解锁可继续加密保存', async () => {
    const v = useVault()
    await v.setMasterPassword('pw123456')
    v.lock()
    expect(await v.unlock('wrong-pass')).toBe(false)
    expect(await v.unlock('pw123456')).toBe(true)

    await v.writeDocument('/vault/a.md', '# 再保存')
    expect(sealedWrites).toHaveLength(1)
  })
})

describe('useVault · 打开时自动识别密文', () => {
  it('明文文件走传入的 reader', async () => {
    const v = useVault()
    await v.refreshEnabled()
    const text = await v.readDocument('/vault/plain.md', async () => '# 明文文件')
    expect(text).toBe('# 明文文件')
  })

  it('密文文件在已解锁会话下自动解密', async () => {
    const v = useVault()
    await v.setMasterPassword('pw123456')
    encryptedFiles.add('/vault/secret.md')

    const text = await v.readDocument('/vault/secret.md')
    expect(text).toBe('# 解密后的正文')
  })
})
