exports.product = (e, editing) => {
  for (const field of ['beli','sell_1','sell_2','sell_3','sell_4','sell_5','sell_6','min_1','min_2','min_3','stok_1','stok_2','stok_3']) {
    const value = e.record.getFloat(field);
    if (!Number.isSafeInteger(value) || value < 0) throw new BadRequestError(`${field} harus bilangan bulat nol atau lebih.`);
  }
  if (!editing && e.auth && e.auth.collection().name === 'user' && e.auth.getInt('level') !== 1 && e.record.getFloat('beli') !== 0) throw new ForbiddenError('Hanya administrator dapat mengatur harga beli.');
  if (!editing && e.record.getFloat('stok_3') !== 0) throw new BadRequestError('Stok awal harus dicatat melalui log_stock dalam batch produk.');
  if (editing && e.record.getFloat('stok_3') !== e.record.original().getFloat('stok_3')) throw new BadRequestError('Stok realtime hanya dapat diubah melalui log_stock.');
};
exports.deletion = (e) => {
  const linked = e.app.findRecordsByFilter('log_stock', 'item_baru = {:id} || (item != "" && item = {:code})', '', 1, 0, {id:e.record.id,code:e.record.getString('id_lama')});
  if (e.record.getFloat('stok_3') !== 0 || linked.length) throw new BadRequestError('Produk masih memiliki stok atau histori transaksi dan tidak dapat dihapus.');
};
exports.stock = (e, editing) => {
  const qty = e.record.getFloat('qty');
  const direction = e.record.getString('boolean');
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new BadRequestError('Kuantitas harus bilangan bulat lebih dari nol.');
  if (!['in','out'].includes(direction)) throw new BadRequestError('Arah stok tidak valid.');
  for (const field of ['price_1','price_2','normal']) {
    const value = e.record.getFloat(field);
    if (!Number.isFinite(value) || value < 0) throw new BadRequestError('Harga tidak boleh negatif.');
  }
  const deltas = {};
  const add = (id, amount) => { if (id) deltas[id] = (deltas[id] || 0) + amount; };
  add(e.record.getString('item_baru'), direction === 'in' ? qty : -qty);
  if (editing) {
    const old = e.record.original();
    add(old.getString('item_baru'), old.getString('boolean') === 'in' ? -old.getFloat('qty') : old.getFloat('qty'));
  }
  for (const id of Object.keys(deltas)) {
    const product = e.app.findRecordById('produk', id);
    if (!(e.requestInfo().context === 'batch' && e.get('pmAtomicBatch')) && product.getFloat('stok_3') + deltas[id] < 0) throw new BadRequestError('Stok produk tidak cukup.');
  }
};
