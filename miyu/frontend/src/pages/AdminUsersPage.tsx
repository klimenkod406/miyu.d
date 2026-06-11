import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { authApi, getStoredTokens } from '../api/auth'

interface User {
  id: number
  email: string
  username: string
  role: string
  created_at?: string
}

const roleStyles: Record<string, string> = {
  user: 'bg-white/[0.05] text-white/70 border-white/[0.08]',
  artist: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  moderator: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  admin: 'bg-red-500/15 text-red-300 border-red-500/20',
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [changingRole, setChangingRole] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState('')

  const fetchUsers = async () => {
    const tokens = getStoredTokens()
    if (!tokens) return
    try {
      const data = await authApi.getUsers(tokens.accessToken)
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()),
  )

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return
    setChangingRole(selectedUser.id)
    try {
      await authApi.updateUserRole(selectedUser.id, newRole)
      setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, role: newRole } : u)))
      setShowModal(false)
      setSelectedUser(null)
      setNewRole('')
    } catch (err) {
      console.error('Failed to change role:', err)
    } finally {
      setChangingRole(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-white/40 text-sm">Управление ролями пользователей платформы</p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по логину или email..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium truncate">{user.username}</p>
              <p className="text-sm text-white/40 truncate">{user.email}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-3 py-1 rounded-full text-xs border ${roleStyles[user.role] || roleStyles.user}`}>
                {user.role}
              </span>
              <button
                onClick={() => {
                  setSelectedUser(user)
                  setNewRole(user.role)
                  setShowModal(true)
                }}
                className="px-3 py-2 rounded-xl text-sm bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition"
              >
                Изменить роль
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0a0a0a] border border-white/10 p-6">
            <h2 className="text-xl font-bold mb-2">Изменить роль</h2>
            <p className="text-white/60 mb-4">Пользователь: {selectedUser.username}</p>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4 outline-none">
              <option value="user">user</option>
              <option value="artist">artist</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">Отмена</button>
              <button onClick={handleRoleChange} disabled={changingRole === selectedUser.id} className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                {changingRole === selectedUser.id ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
