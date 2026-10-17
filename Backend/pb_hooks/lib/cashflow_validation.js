exports.validate = (e, editing) => {
  const record = e.record;
  const amount = record.getFloat('nominal');
  const direction = record.getString('mutasi').toLowerCase();
  const transfer = record.getString('jenis').toLowerCase().includes('transfer');
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError('Nominal harus lebih dari nol.');
  if (!['in', 'out'].includes(direction)) throw new BadRequestError('Mutasi tidak valid.');
  const source = record.getString('account_1');
  const target = record.getString('account_2');
  if (!source) throw new BadRequestError('Akun sumber wajib diisi.');
  if (transfer && (direction !== 'out' || !target || source === target)) throw new BadRequestError('Transfer memerlukan dua akun berbeda dan mutasi keluar.');
  if (!transfer && record.getString('jenis').toLowerCase() !== 'bonkaryawan') {
    record.set('account_2', '');
    record.set('acc2', '');
  }
  const deltas = {};
  const add = (id, value) => { if (id) deltas[id] = (deltas[id] || 0) + value; };
  add(source, direction === 'out' ? -amount : amount);
  if (transfer) add(target, amount);
  if (editing) {
    const old = record.original();
    const oldAmount = old.getFloat('nominal');
    const oldOut = ['out', 'keluar'].includes(old.getString('mutasi').toLowerCase());
    add(old.getString('account_1'), oldOut ? oldAmount : -oldAmount);
    if (oldOut && old.getString('account_2')) {
      try {
        e.app.findRecordById('dropdown', old.getString('account_2'));
        add(old.getString('account_2'), -oldAmount);
      } catch (_) { /* Legacy employee references are not wallets. */ }
    }
  }
  for (const id of Object.keys(deltas)) {
    const account = e.app.findRecordById('dropdown', id);
    if (e.auth && e.auth.collection().name === 'user' && e.auth.getInt('level') !== 1) {
      const contains = (value, token) => value.split(',').map(part => part.trim()).includes(token);
      if (!contains(account.getString('visibilitas'), String(e.auth.getInt('level'))) || !contains(account.getString('enum_1'), e.auth.getString('username'))) {
        throw new ForbiddenError('Anda tidak memiliki akses ke akun ini.');
      }
    }
    if (account.getFloat('number_1') + deltas[id] < -0.00001) throw new BadRequestError('Saldo akun tidak cukup untuk perubahan ini.');
  }
};
