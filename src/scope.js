'use strict';

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatcher = null;
  this.$$TTL = 10;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$postDigestQueue = [];
  this.$$phase = null;

  this.$watch = function(watcherFn, listenerFn, compareByValue) {
    compareByValue = compareByValue ? true : false;
    this.$$lastDirtyWatcher = null;

    var thisWatcher = {
      watcherFn: watcherFn,
      listenerFn: listenerFn || function(){},
      compareByValue: compareByValue,
      last: function initWatchValue() {}
    };
    this.$$watchers.unshift(thisWatcher);

    return function() {
      var index = this.$$watchers.indexOf(thisWatcher);
      if (index >= 0) {
        this.$$watchers.splice(index, 1);
        this.$$lastDirtyWatcher = null;
      }
    }.bind(this);
  };

  this.$beginPhase = function(phase) {
    if (this.$$phase) {
      throw this.$$phase + ' already in progress';
    }
    this.$$phase = phase;
  };

  this.$clearPhase = function() {
    this.$$phase = null;
  };

  this.$digest = function() {
    var dirty, iterations;
    iterations = 0;
    this.$$lastDirtyWatcher = null;
    this.$beginPhase('$digest');

    if (this.$$applyAsyncId) {
      clearTimeout(this.$$applyAsyncId);
      this.$$flushApplyAsync();
    }

    do {
      while (this.$$asyncQueue.length) {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.fn);
      }
      dirty = this.$$digestOnce();
      iterations++;
      if ((dirty || this.$$asyncQueue.length) && iterations >= this.$$TTL) {
        this.$clearPhase();
        throw "Max digests exceeded";
      }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();
    this.$$flushPostDigestQueue();
  };

  this.$$digestOnce = function() {
    var newValue, oldValue, dirty;
    _.forEachRight(this.$$watchers, function(watcher){
      if (watcher) {
        try {
          newValue = watcher.watcherFn(this);
          oldValue = watcher.last;
          if (!this.$$areEqual(newValue, oldValue, watcher.compareByValue)) {
            dirty = true;
            this.$$lastDirtyWatcher = watcher;
            watcher.last = watcher.compareByValue ? _.cloneDeep(newValue) : newValue;
            watcher.listenerFn(newValue, oldValue, this);
          } else if (this.$$lastDirtyWatcher === watcher) {
            return false; //return false in a lodash loop causes it to break
          }
        } catch (e) {
          console.error(e);
        }
      }
    }.bind(this));

    return dirty;
  };

  this.$$postDigest = function(fn){
    this.$$postDigestQueue.push(fn);
  };

  this.$$areEqual = function(newValue, oldValue, compareByValue) {
    if (compareByValue) return _.isEqual(newValue, oldValue);
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
  };

  this.$eval = function(fn, locals) {
    return fn(this, locals);
  };

  this.$apply = function(fn, locals) {
    this.$beginPhase('$apply');
    try {
      fn(this, locals);
    } finally {
      this.$clearPhase();
      this.$digest();
    }
    this.$clearPhase();
  };

  this.$evalAsync = function(fn) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      setTimeout(function(){
        if (this.$$asyncQueue.length) this.$digest();
      }.bind(this), 0);
    }

    this.$$asyncQueue.push({
      scope: this,
      fn: fn
    });
  };

  this.$applyAsync = function(fn) {
    this.$$applyAsyncQueue.push(function(){
      this.$eval(fn);
    }.bind(this));

    if (!this.$$applyAsyncId) {
      this.$$applyAsyncId = setTimeout(function(){
        this.$apply(_.bind(this.$$flushApplyAsync, this));
      }.bind(this), 0);
    }
  };

  this.$$flushApplyAsync = function() {
    while (this.$$applyAsyncQueue.length) {
      this.$$applyAsyncQueue.shift()();
    }
    this.$$applyAsyncId = null;
  };

  this.$$flushPostDigestQueue = function() {
    while (this.$$postDigestQueue.length) {
      this.$$postDigestQueue.shift()();
    }
  };
}

module.exports = Scope;
