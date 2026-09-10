import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVault } from '../../src/composables/useVault'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('useVault', () => {
  it('setMasterPassword stores a verifier; verifyMasterPassword validates', async () => {
    const tauri = getTauri()
    const store: Record<string, string> = {}
    tauri.invoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'encrypt_text') return btoa(args.plaintext + '|' + args.password)
      if (cmd === 'decrypt_text') {
        const [pt, pw] = atob(args.ciphertextB64).split('|')
        if (pw !== args.password) throw new Error('bad')
        return pt
      }
      if (cmd === 'set_setting') {
        store[args.key] = args.value
        return undefined
      }
      if (cmd === 'get_setting') return store[args.key] ?? null
      return undefined
    })
    const v = useVault()
    await v.setMasterPassword('secret')
    expect(await v.verifyMasterPassword('secret')).toBe(true)
    expect(await v.verifyMasterPassword('bad')).toBe(false)
    expect(await v.hasMasterPassword()).toBe(true)
  })

  it('encryptText / decryptText round-trips via mocked invoke', async () => {
    const tauri = getTauri()
    tauri.invoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'encrypt_text') return btoa(args.plaintext + '|' + args.password)
      if (cmd === 'decrypt_text') {
        const [pt, pw] = atob(args.ciphertextB64).split('|')
        if (pw !== args.password) throw new Error('bad')
        return pt
      }
      return undefined
    })
    const v = useVault()
    const ct = await v.encryptText('hello', 'pw')
    expect(await v.decryptText(ct, 'pw')).toBe('hello')
    await expect(v.decryptText(ct, 'wrong')).rejects.toThrow()
  })
})
