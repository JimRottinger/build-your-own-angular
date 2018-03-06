'use strict';

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatcher = null;
  this.$$TTL = 10;
  this.$$asyncQueue = [];

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

  this.$digest = function() {
    var dirty, iterations;
    iterations = 0;
    this.$$lastDirtyWatcher = null;
    do {
      while (this.$$asyncQueue.length) {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.fn);
      }
      dirty = this.$$digestOnce();
      iterations++;
      if ((dirty || this.$$asyncQueue.length) && iterations >= this.$$TTL) throw "Max digests exceeded";
    } while (dirty || this.$$asyncQueue.length);
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

  this.$$areEqual = function(newValue, oldValue, compareByValue) {
    if (compareByValue) return _.isEqual(newValue, oldValue);
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
  };

  this.$eval = function(fn, locals) {
    return fn(this, locals);
  };

  this.$apply = function(fn, locals) {
    try {
      fn(this, locals);
    } finally {
      this.$digest();
    }
  };

  this.$evalAsync = function(fn) {
    this.$$asyncQueue.push({
      scope: this,
      fn: fn
    });
  };
}

module.exports = Scope;
