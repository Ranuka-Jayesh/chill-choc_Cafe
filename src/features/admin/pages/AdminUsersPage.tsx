import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { authService } from '@/services/authService';
import { User, Role } from '@/types';
import { db } from '@/services/storage/db';
import { confirmDialog } from '@/store/useConfirmStore';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  KeyRound,
  CheckCircle2,
  X,
  Search,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(authService.getUsers());
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'CASHIER'>('ALL');
  
  // Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('CASHIER');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(true);

  // Pin visibility state for cards
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = db.subscribe(() => setUsers(authService.getUsers()));
    return unsub;
  }, []);

  // Filtered staff list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const togglePinReveal = (userId: string) => {
    setRevealedPins((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setRole('CASHIER');
    setPin('');
    setActive(true);
    setIsCreating(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    setRole(user.role);
    setPin(user.pin);
    setActive(user.active);
    setIsCreating(true);
  };

  const handleToggleActive = (user: User) => {
    authService.saveUser({
      ...user,
      active: !user.active,
    });
    toast.success(`${user.name} is now ${!user.active ? 'Active' : 'Inactive'}.`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !pin.trim()) {
      toast.error('Please fill in full name, username and 4-digit PIN.');
      return;
    }

    if (pin.trim().length < 4) {
      toast.error('Terminal PIN must be at least 4 digits.');
      return;
    }

    authService.saveUser({
      id: editingUser?.id,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      role: role,
      pin: pin.trim(),
      active: active,
    });

    toast.success(editingUser ? 'Staff profile updated.' : 'New staff member added.');
    setIsCreating(false);
    setEditingUser(null);
  };

  // Delete with standardized confirmation modal
  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirmDialog({
      title: 'Delete Staff Member',
      message: `Permanently delete "${user.name}" (@${user.username})?`,
      confirmText: 'Delete Staff Member',
      variant: 'danger',
    });

    if (confirmed) {
      authService.deleteUser(user.id);
      toast.success(`"${user.name}" was deleted successfully.`);
    }
  };

  return (
    <div className="space-y-4 w-full pb-32 animate-in fade-in">
      {/* 1. TOP HEADER & ROLE SELECTOR BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E9E0D5] shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-brand-brown-dark tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-teal" />
            Staff & Terminal Operators
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage cashier logins, PIN security & role authorizations for POS terminals
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-full border border-[#E0D7CC] shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setRoleFilter('ALL')}
            className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
              roleFilter === 'ALL'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'text-brand-brown hover:bg-cream-100'
            }`}
          >
            All ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('CASHIER')}
            className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
              roleFilter === 'CASHIER'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'text-brand-brown hover:bg-cream-100'
            }`}
          >
            Cashiers ({users.filter((u) => u.role === 'CASHIER').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('ADMIN')}
            className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
              roleFilter === 'ADMIN'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'text-brand-brown hover:bg-cream-100'
            }`}
          >
            Admins ({users.filter((u) => u.role === 'ADMIN').length})
          </button>
        </div>
      </div>

      {/* 2. RESPONSIVE OPERATOR CARDS GRID */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E9E0D5] p-12 text-center shadow-xs">
          <Users className="w-12 h-12 text-brand-brown/30 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-brand-brown-dark">No staff members found</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            {search ? `No staff operators matching "${search}".` : 'Get started by adding your first cashier or admin account.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-black shadow-teal transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((u) => {
            const isRevealed = !!revealedPins[u.id];
            const isAdmin = u.role === 'ADMIN';

            return (
              <div
                key={u.id}
                className={`bg-white p-5 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between ${
                  u.active ? 'border-[#E9E0D5]' : 'border-zinc-200 opacity-60 bg-zinc-50/70'
                }`}
              >
                <div>
                  {/* Avatar & Header */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar Circle with Initials */}
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0 ${
                          isAdmin
                            ? 'bg-teal-50 text-brand-teal-dark border border-teal-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-brand-brown-dark tracking-tight truncate">
                          {u.name}
                        </h3>
                        <div className="text-[11px] font-mono text-text-secondary mt-0.5 truncate">
                          @{u.username}
                        </div>
                      </div>
                    </div>

                    {/* Quick Edit & Delete Icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-brand-teal hover:bg-teal-50 transition-all cursor-pointer"
                        title="Edit Staff Member"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Remove Staff Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Role Badge & Status Indicator */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0EAE1]">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                        isAdmin
                          ? 'bg-teal-50 text-brand-teal-dark border-teal-200'
                          : 'bg-[#FAF7F2] text-brand-brown border-[#E0D7CC]'
                      }`}
                    >
                      {u.role}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(u)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                        u.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-300'
                      }`}
                      title="Toggle active status"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      {u.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                {/* Bottom: Terminal PIN Peek */}
                <div className="mt-3.5 pt-3 border-t border-[#F0EAE1] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <KeyRound className="w-3.5 h-3.5 text-brand-brown" />
                    <span className="font-semibold text-[11px]">PIN:</span>
                    <span className="font-mono font-extrabold text-brand-brown-dark tracking-widest text-xs">
                      {isRevealed ? u.pin : '••••'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePinReveal(u.id)}
                    className="text-[11px] font-bold text-brand-teal hover:text-brand-teal-dark flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isRevealed ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> View
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. FLOATING BOTTOM-CENTER ADD BUTTON */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-5 pr-1.5 flex items-center gap-3 active:scale-95 transition-all cursor-pointer pointer-events-auto group hover:border-brand-teal/40"
          title="Add New Staff Member"
        >
          <span className="text-xs font-bold text-white tracking-wide">
            Add Staff Member
          </span>
          <div className="w-10 h-10 rounded-full bg-brand-teal group-hover:bg-brand-teal-dark text-white flex items-center justify-center shadow-lg shadow-brand-teal/30 active:scale-95 transition-all shrink-0">
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </div>
        </button>
      </div>

      {/* 4. MODAL POPUP: ADD / EDIT STAFF OPERATOR (Mounted via Portal to blur entire screen including top header) */}
      {isCreating &&
        createPortal(
          <div className="fixed inset-0 z-[999999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-150">
            <div className="relative w-full max-w-[420px] bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#E9E0D5] space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Header with Cafe Logo & Title */}
              <div className="flex items-center gap-3.5">
                <img
                  src="/logobg.webp"
                  alt="Chill & Choc"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-brand-brown-dark tracking-tight leading-snug">
                    {editingUser ? 'Edit Staff Member' : 'Add Staff Member'}
                  </h3>
                  <p className="text-xs text-text-secondary leading-snug mt-0.5">
                    {editingUser ? `Update credentials for ${editingUser.name}` : 'Set up cashier or admin POS access credentials'}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSave} className="space-y-3.5 pt-2 border-t border-[#F2ECE4]">
                <div>
                  <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                    Full Name <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nimal Perera"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D7CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                    Username / Login Handle <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. nimal"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D7CC] text-xs font-bold text-brand-brown-dark font-mono focus:outline-none focus:border-brand-teal transition-colors"
                    required
                  />
                </div>

                {/* Role Selection */}
                <div>
                  <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1.5">
                    Assigned Role <span className="text-status-danger">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('CASHIER')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        role === 'CASHIER'
                          ? 'border-brand-teal bg-teal-50/60 ring-1 ring-brand-teal'
                          : 'border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100'
                      }`}
                    >
                      <div className="text-xs font-black text-brand-brown-dark">Cashier</div>
                      <div className="text-[10px] text-text-secondary">POS Register & Drawer</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('ADMIN')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        role === 'ADMIN'
                          ? 'border-brand-teal bg-teal-50/60 ring-1 ring-brand-teal'
                          : 'border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100'
                      }`}
                    >
                      <div className="text-xs font-black text-brand-brown-dark">Admin</div>
                      <div className="text-[10px] text-text-secondary">Full System & Reports</div>
                    </button>
                  </div>
                </div>

                {/* 4-Digit PIN */}
                <div>
                  <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                    Terminal 4-Digit PIN <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D7CC] text-sm font-black font-mono tracking-widest text-center text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors"
                    required
                  />
                </div>

                {/* Status Switch */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-brand-brown-dark">Account Active</span>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      active ? 'bg-brand-teal' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Modal Actions */}
                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#F2ECE4]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingUser(null);
                    }}
                    className="px-4 py-1.5 rounded-full border border-[#E0D7CC] text-xs font-bold text-brand-brown hover:bg-cream-100 transition-all active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 cursor-pointer"
                  >
                    {editingUser ? 'Update Staff Member' : 'Add Staff Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
