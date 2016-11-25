var assert = require('assert');
var ClusterPool = require('..');

describe('ClusterPool', function() {
  this.timeout(20000);

  var createCounts = [0, 0, 0];
  var acquireCounts = [0, 0, 0];
  var releaseCount = 0;
  var acquireHistory = '';

  it('should load balance requests to lagged servers selecting pool with the smallest queue', function(done) {
    var factory = {
      max: 4,
      idleTimeoutMillis : 1000,
      destroy  : function(client) {}
    }
    
    var clusterPool = ClusterPool.create(factory);
    
    clusterPool.add(function(callback) {
      callback(null, {pool: 0, count: createCounts[0]++});
    });
    clusterPool.add(function(callback) {
      callback(null, {pool: 1, count: createCounts[1]++});
    });
    clusterPool.add(function(callback) {
      callback(null, {pool: 2, count: createCounts[2]++});
    });

    function open() {
      clusterPool.acquire(function(err, client, pool) {
        acquireCounts[client.pool]++;
        acquireHistory += client.pool
        setTimeout(function() {
          pool.release(client);
          releaseCount++;
          if(releaseCount == 96) {
            done();
          }
        }, ((client.pool+1) * 1000));
      });
    }
        
    for (var i = 0; i < 96; i++) {
      setTimeout(open, i * 105);
    }
  });
  
  after(function() {  
    assert.equal(4, createCounts[0]);
    assert.equal(4, createCounts[1]);
    assert.equal(4, createCounts[2]);
    assert.equal(47, acquireCounts[0]);
    assert.equal(27, acquireCounts[1]);
    assert.equal(22, acquireCounts[2]);
    
    assert.equal('012012012012000010100101202002012010010100001201200120120000101001012020020120100101000121212222', acquireHistory);
  });
});