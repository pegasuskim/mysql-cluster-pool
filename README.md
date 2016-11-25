# About

**Generic pools meet load balancing within cluster of servers, for multi-server environments.**

This module extends [Generic resource pool module](https://github.com/coopernurse/node-pool), which can be used to reuse or throttle expensive resources such as database connections. Cluster-pool module allows pooling connections to multi-server environments (e.g. multi-slave replicated database systems) - it creates separate connection pools for multiple servers in a cluster and provides simple load balancing of requests to these connection pools (and effectively to servers).

There's a separate connection pool created for each server in the cluster. Requests for connections are load balanced between server pools, with the least busy server getting new connection requests.

## Table of contents

* [Installation](#installation)
* [Usage](#usage)
  * [Step 1 - Create cluster pool using a factory object](#step-1---create-cluster-pool-using-a-factory-object)
  * [Step 2 - Add servers to the cluster](#step-2---add-servers-to-the-cluster)
  * [Step 3 - Use cluster pool in your code to acquire/release resources](#step-3---use-cluster-pool-in-your-code-to-acquirerelease-resources)
* [Master-slave environments](#master-slave-environments)
* [How the load balancing works](#how-the-load-balancing-works)
* [Error handling](#error-handling)
* [Additional features](#additional-features)
* [Run tests](#run-tests)
* [Version History](#version-history)
* [License](#license) (The MIT License)

## Installation

```
$ npm install cluster-pool
```

## Usage

If you are familiar with [node-pool module](https://github.com/coopernurse/node-pool) you will recognize that there are only few changes required to switch to cluster-pool module.

### Step 1 - Create cluster pool using a factory object

```javascript
// Create a MySQL connection pool with a max of 10 connections, a min of 2
// and a 30 seconds max idle time. These settings will be used for all pools
// created for individual servers.
var ClusterPool = require('cluster-pool');

var cluster = ClusterPool.create({
  name: 'mysql',
  destroy: function(client) { client.end(); },
  max: 10,
  min: 2,
  idleTimeoutMillis : 30000
});
```

The difference to generic-pool module is that factory object doesn't contain connect function - it will be defined for each server in cluster. For documentation of factory object fields (and other pool features), please refer to [generic-pool documentation](https://github.com/coopernurse/node-pool#documentation).

### Step 2 - Add servers to the cluster

```javascript
var MySQLClient = require('mysql').Client;

// Add server to the cluster
cluster.add(function(callback) {
  var client = new MySQLClient();
  client.user = 'username';
  client.password = 'password';
  client.database = 'dbname';
  client.host = 'host 1';
  client.connect(function(err) {
    callback(err, client);
  });
});

// Add another server to the cluster
cluster.add(function(callback) {
  var client = new MySQLClient();
  client.user = 'username';
  client.password = 'password';
  client.database = 'dbname';
  client.host = 'host 2';
  client.connect();
  client.connect(function(err) {
    callback(err, client);
  });
});

// … repeat for as many servers as you have in cluster.
```

Add as many servers as you have in cluster. In the above example we have two servers at two different hosts added to the cluster. Each of these servers will have a separate connection pool created with settings from the factory object used to create server pool.

### Step 3 - Use cluster pool in your code to acquire/release resources

```javascript
// Acquire connection - callback function is called once a resource becomes
// available.
cluster.acquire(function(err, client, pool) {
  if (err) {
    // Handle error - this is generally the err from your create function.
  } else {
    client.query('SELECT * FROM foo', [], function() {
      // Release connection object back to the pool.
      pool.release(client);
    });
  }
});
```

If you're familiar with generic-pool, you'll see the only difference is that your callback function receives not only client connection, but also pool object for the server which has been chosen to serve your request. You use it to release client back to this specific pool after you're done.

## Master-slave environments

If you have one master server and multiple slaves, just create slave cluster with multiple slave servers added and master cluster with single master server.

```javascript
var ClusterPool = require('cluster-pool');

var master = ClusterPool.create({ /* factory settings */ });
master.add(function(callback) { /* Connect to master */ });

var slave = ClusterPool.create({ /* factory settings */ });
slave.add(function(callback) { /* Connect to slave #1 */ });
slave.add(function(callback) { /* Connect to slave #2 */ });
slave.add(function(callback) { /* Connect to slave #3 */ });
// …

// When you need to write, acquire master
master.acquire(function(err, client, poll) { /* Do something. */ });

// When you need to read, acquire one of the slaves balanced
slave.acquire(function(err, client, poll) { /* Do something. */ });
```

## How the load balancing works

Each server in the cluster has its own connection pool created with specified min and max number of connections to launch. They are launched when first needed and then are waiting to be reused.

If there are any launched connections available to use (or new connections can be launched because we don't have max number of connections yet), requests are round-robin rotated between servers with available connections in pool - so each server gets an equal share of connections.

If all connections are busy and there's a waiting queue, cluster-pool checks waiting queues of all servers and selects the server with the shortest waiting queue. Request for connection is sent to its connection pool - so when your cluster is busy, new connections are directed to the least busy server.

## Error handling

Error handling is done node-style, so callback functions should accept *Error* object as first argument (or *null* value if there was no error).

Function creating connection, which you pass to *add()* method, should call provided callback with *Error|null* as first argument and connection object as second.

Function provided as callback to *acquire()* method, should accept *Error|null* as its first argument. In general, this will be the same *Error* object which was generated in your function creating connection.

## Additional features

### getClusterSize()

Return number of servers in the cluster.

### getPoolSize()

Return total number of launched connections in all server pools.

### availableObjectsCount()

Return total number of connections ready to use in all server pools.

### waitingClientsCount()

Return total number of requests waiting for available connections in all server pools.

## Run tests

```
$ npm install mocha
$ node_modules/mocha/bin/mocha
```

You can avoid providing path to mocha bin if you install mocha module globally: ```npm install -g mocha```.

The included test simulates cluster of three servers with pool of maximum 4 connections to each one. There is a simulated lag time for each of servers of 1000, 2000 and 3000 milliseconds respectively and 96 requests for connections performed every 105 milliseconds. As the requests are made, some server pools are getting full, some connections are released, and this example demonstrates how less-busy servers from cluster are chosen. In summary, server with bigger lag serves less connections than server with smaller lag.

## Version History

### 1.1.2 - Feb 9, 2013

* Bug fix: Refactored module so that now it can create multiple, separate clusters, e.g. master db cluster and slave db cluster.
* Switched test suite to mocha.
* Fixed global variable leak.

### 1.1.1 - Feb 8, 2013

* More detailed documentation in README.md file.

### 1.1.0 - Feb 8, 2013

* Changed algorithm selecting server pool from round-robin to load balancing requests and selecting server pool with the lowest waiting queue, so that requests are served with the least busy server pool. In case if there are no waiting requests, round-robin is still used to distribute requests to all servers evenly.
* Added getClusterSize()
* Added getPoolSize()
* Added availableObjectsCount()
* Added waitingClientsCount()

### 1.0.0 - Feb 7, 2013

* First release.

## License

(The MIT License)

Copyright (C) 2013

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
