// Khoi tao single-node replica set cho local dev/test (Phan 10 v6 §6.2b).
// Chay: mongosh --eval "rs.initiate()" hoac mount file nay vao /docker-entrypoint-initdb.d
/* eslint-disable no-undef -- `rs` la global cua mongosh, khong phai bien JS thuong. */
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: 'mongo:27017' }]
});
/* eslint-enable no-undef */
