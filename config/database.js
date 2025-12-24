const { PrismaClient } = require('@prisma/client');

function createInMemoryPrisma() {
  const users = [
    { user_id: 'mahasiswa_001', email: 'mahasiswa@example.com', password: '$2b$10$t9bapv1MFDqYjzn5NLCSGOT2UjPyLCqEs0u8BKZtBGcfDG5TBzIKm', role: 'mahasiswa', name: 'Mahasiswa A' },
    { user_id: 'pengelola_001', email: 'adminpengelola@example.com', password: '$2b$10$nDcHZlLwHC22XEWPVOIPk.T4iwufxppoITOrDfBkMETY2ahal1INy', role: 'pengelola', name: 'Admin' }
  ];
  let mahasiswa = [
    { mahasiswa_id: 1, nim: '2111001', nama: 'Mahasiswa A', jurusan: 'Sistem Informasi', status: 'aktif', kipk: 'ya', user_id: 'mahasiswa_001' }
  ];
  let pengelolaasrama = [
    { Pengelola_id: 99, user_id: 'pengelola_001' }
  ];
  let izinkeluar = [];
  let pelaporankerusakan = [];
  let pemberitahuan = [];

  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const pick = (obj, select) => {
    if (!obj || !select) return obj;
    const out = {};
    for (const k of Object.keys(select)) {
      if (select[k]) out[k] = obj[k];
    }
    return out;
  };

  return {
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: async (fn) => {
      const tx = {
        pengelolaasrama: {
          findFirst: async ({ where } = {}) => {
            if (where?.user?.user_id) {
              return clone(pengelolaasrama.find(p => p.user_id === where.user.user_id) || null);
            }
            if (where?.user_id) {
              return clone(pengelolaasrama.find(p => p.user_id === where.user_id) || null);
            }
            return null;
          }
        },
        pemberitahuan: {
          findFirst: async ({ where } = {}) => {
            return clone(pemberitahuan.find(p => p.pemberitahuan_id === Number(where?.pemberitahuan_id) && (where?.Pengelola_id == null || p.Pengelola_id === where.Pengelola_id)) || null);
          },
          delete: async ({ where }) => {
            const idx = pemberitahuan.findIndex(p => p.pemberitahuan_id === Number(where.pemberitahuan_id));
            if (idx !== -1) {
              const del = pemberitahuan[idx];
              pemberitahuan.splice(idx, 1);
              return clone(del);
            }
            return null;
          }
        },
        notification: {
          deleteMany: async ({ where } = {}) => {
            return { count: 0 };
          }
        }
      };
      return await fn(tx);
    },
    user: {
      findUnique: async ({ where }) => {
        if (where?.email) return clone(users.find(u => u.email === where.email) || null);
        if (where?.user_id) return clone(users.find(u => u.user_id === where.user_id) || null);
        return null;
      },
      count: async () => users.length,
      create: async ({ data }) => { users.push(data); return clone(data); }
    },
    mahasiswa: {
      findFirst: async ({ where, select } = {}) => {
        let m = null;
        if (where?.user_id) m = mahasiswa.find(x => x.user_id === where.user_id) || null;
        return select ? pick(clone(m), select) : clone(m);
      },
      findUnique: async ({ where, select, include } = {}) => {
        let m = null;
        if (where?.mahasiswa_id != null) m = mahasiswa.find(x => x.mahasiswa_id === Number(where.mahasiswa_id)) || null;
        let out = select ? pick(clone(m), select) : clone(m);
        if (include?.user && out) {
          out.user = clone(users.find(u => u.user_id === out.user_id) || null);
        }
        return out;
      },
      findMany: async ({ include } = {}) => {
        let list = mahasiswa.slice();
        if (include?.user) list = list.map(m => ({ ...m, user: clone(users.find(u => u.user_id === m.user_id) || null) }));
        return clone(list);
      },
      updateMany: async ({ where, data }) => {
        mahasiswa = mahasiswa.map(m => (where?.user_id === m.user_id ? { ...m, ...data } : m));
        return { count: 1 };
      }
    },
    pengelolaasrama: {
      findFirst: async ({ where, select } = {}) => {
        let p = null;
        if (where?.user_id) p = pengelolaasrama.find(x => x.user_id === where.user_id) || null;
        return select ? pick(clone(p), select) : clone(p);
      },
      findMany: async ({ include } = {}) => {
        let list = pengelolaasrama.slice();
        if (include?.user) list = list.map(p => ({ ...p, user: clone(users.find(u => u.user_id === p.user_id) || null) }));
        return clone(list);
      }
    },
    izinkeluar: {
      create: async ({ data }) => {
        const id = izinkeluar.length + 1;
        const rec = { izin_id: id, submitted_at: new Date(), status: 'pending', ...data };
        izinkeluar.push(rec);
        return clone(rec);
      },
      findUnique: async ({ where }) => clone(izinkeluar.find(x => x.izin_id === Number(where.izin_id)) || null),
      findMany: async ({ where, orderBy, include } = {}) => {
        let list = izinkeluar.slice();
        if (where?.mahasiswa_id != null) list = list.filter(x => x.mahasiswa_id === Number(where.mahasiswa_id));
        if (orderBy?.submitted_at) list.sort((a,b)=> new Date(b.submitted_at) - new Date(a.submitted_at));
        if (include?.mahasiswa) list = list.map(x => ({ ...x, mahasiswa: pick(mahasiswa.find(m => m.mahasiswa_id === x.mahasiswa_id) || {}, include.mahasiswa.select || {}) }));
        return clone(list);
      },
      update: async ({ where, data }) => {
        const i = izinkeluar.findIndex(x => x.izin_id === Number(where.izin_id));
        if (i === -1) return null;
        izinkeluar[i] = { ...izinkeluar[i], ...data };
        return clone(izinkeluar[i]);
      },
      deleteMany: async ({ where }) => {
        const before = izinkeluar.length;
        izinkeluar = izinkeluar.filter(x => x.mahasiswa_id !== Number(where.mahasiswa_id));
        return { count: before - izinkeluar.length };
      }
    },
    pelaporankerusakan: {
      create: async ({ data }) => {
        const id = pelaporankerusakan.length + 1;
        const rec = { laporan_id: id, status: 'ditinjau', date_submitted: new Date(), ...data };
        pelaporankerusakan.push(rec);
        return clone(rec);
      },
      findUnique: async ({ where, include } = {}) => {
        const rec = pelaporankerusakan.find(x => x.laporan_id === Number(where.laporan_id)) || null;
        if (!rec) return null;
        if (include?.mahasiswa) return clone({ ...rec, mahasiswa: mahasiswa.find(m => m.mahasiswa_id === rec.mahasiswa_id) || null });
        return clone(rec);
      },
      findMany: async ({ where, orderBy, include } = {}) => {
        let list = pelaporankerusakan.slice();
        if (where?.mahasiswa_id != null) list = list.filter(x => x.mahasiswa_id === Number(where.mahasiswa_id));
        if (orderBy?.date_submitted) list.sort((a,b)=> new Date(b.date_submitted) - new Date(a.date_submitted));
        if (include?.mahasiswa) list = list.map(x => ({ ...x, mahasiswa: pick(mahasiswa.find(m => m.mahasiswa_id === x.mahasiswa_id) || {}, include.mahasiswa.select || {}) }));
        return clone(list);
      },
      update: async ({ where, data }) => {
        const i = pelaporankerusakan.findIndex(x => x.laporan_id === Number(where.laporan_id));
        if (i === -1) return null;
        pelaporankerusakan[i] = { ...pelaporankerusakan[i], ...data };
        return clone(pelaporankerusakan[i]);
      },
      deleteMany: async ({ where }) => {
        const before = pelaporankerusakan.length;
        pelaporankerusakan = pelaporankerusakan.filter(x => x.mahasiswa_id !== Number(where.mahasiswa_id));
        return { count: before - pelaporankerusakan.length };
      }
    },
    notification: {
      create: async ({ data }) => ({ notification_id: Date.now(), ...data }),
      findMany: async ({ where, orderBy } = {}) => {
        return [];
      },
      updateMany: async ({ where, data } = {}) => ({ count: 1 }),
      deleteMany: async ({ where } = {}) => ({ count: 0 })
    },
    pemberitahuan: {
      count: async () => pemberitahuan.length,
      findMany: async ({ orderBy, skip = 0, take = 20, include } = {}) => {
        let list = pemberitahuan.slice();
        if (orderBy?.date === 'desc') list.sort((a,b)=> new Date(b.date || 0) - new Date(a.date || 0));
        list = list.slice(skip, skip + take);
        if (include?.pengelolaasrama?.include?.user?.select?.name) {
          list = list.map(p => ({ ...p, pengelolaasrama: { user: { name: (users.find(u => u.user_id === (pengelolaasrama.find(x => x.Pengelola_id === p.Pengelola_id)?.user_id))?.name) || 'Admin' } } }));
        }
        return clone(list);
      },
      findFirst: async ({ where } = {}) => {
        return clone(pemberitahuan.find(p => p.pemberitahuan_id === Number(where?.pemberitahuan_id) && (where?.Pengelola_id == null || p.Pengelola_id === where.Pengelola_id)) || null);
      },
      findUnique: async ({ where } = {}) => {
        return clone(pemberitahuan.find(p => p.pemberitahuan_id === Number(where?.pemberitahuan_id)) || null);
      },
      create: async ({ data, include } = {}) => {
        const id = (pemberitahuan[pemberitahuan.length - 1]?.pemberitahuan_id || 0) + 1;
        const rec = { pemberitahuan_id: id, date: new Date(), ...data };
        pemberitahuan.push(rec);
        if (include?.pengelolaasrama?.include?.user?.select?.name) {
          const peng = pengelolaasrama.find(x => x.Pengelola_id === rec.Pengelola_id);
          return clone({ ...rec, pengelolaasrama: { user: { name: (users.find(u => u.user_id === peng?.user_id)?.name) || 'Admin' } } });
        }
        return clone(rec);
      },
      update: async ({ where, data, include } = {}) => {
        const idx = pemberitahuan.findIndex(p => p.pemberitahuan_id === Number(where.pemberitahuan_id));
        if (idx === -1) return null;
        pemberitahuan[idx] = { ...pemberitahuan[idx], ...data };
        let rec = pemberitahuan[idx];
        if (include?.pengelolaasrama?.include?.user?.select?.name) {
          const peng = pengelolaasrama.find(x => x.Pengelola_id === rec.Pengelola_id);
          rec = { ...rec, pengelolaasrama: { user: { name: (users.find(u => u.user_id === peng?.user_id)?.name) || 'Admin' } } };
        }
        return clone(rec);
      }
    }
  };
}

const prisma = process.env.DATABASE_URL ? new PrismaClient() : createInMemoryPrisma();

async function connectToDatabase() {
  try { await prisma.$connect(); } catch (err) {}
}

module.exports = { prisma, connectToDatabase };
