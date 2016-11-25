var assert = require('assert');
var ClusterPool = require('..');

describe('Multiple clusters for master & slave environments', function() {
  it('should create two separate clusters', function(done) {
    var factory = {
      max: 4,
      idleTimeoutMillis : 1000,
      destroy  : function(client) {}
    }
    
    var master = ClusterPool.create(factory);
    master.add(function(callback) {
      callback(null, {pool: 'master'});
    });
        
    var slave = ClusterPool.create(factory);
    slave.add(function(callback) {
      callback(null, {pool: 'slave'});
    });
    slave.add(function(callback) {
      callback(null, {pool: 'slave'});
    });
    
    var count = 0;
    for(var i = 0; i < 100; i++) {
      count++;

      master.acquire(function(err, client, pool) {
        assert.equal(client.pool, 'master');
        pool.release(client);
      });

      slave.acquire(function(err, client, pool) {
        assert.equal(client.pool, 'slave');
        pool.release(client);
      });

      if(count === 100) {
        done();
      }
    }
  });

});