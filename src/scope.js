'use strict';

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatcher = null;
  this.$$TTL = 10;

  this.$watch = function(watcherFn, listenerFn, compareByValue) {
    compareByValue = compareByValue ? true : false;
    this.$$lastDirtyWatcher = null;
    this.$$watchers.push({
      watcherFn: watcherFn,
      listenerFn: listenerFn || function(){},
      compareByValue: compareByValue,
      last: function initWatchValue() {}
    });
  };

  this.$digest = function() {
    var dirty, iterations;
    iterations = 0;
    this.$$lastDirtyWatcher = null;
    do {
      dirty = this.$$digestOnce();
      iterations++;
      if (dirty && iterations >= this.$$TTL) throw "Max digests exceeded";
    } while (dirty);
  };

  this.$$digestOnce = function() {
    var newValue, oldValue, dirty;
    _.each(this.$$watchers, function(watcher){
      newValue = watcher.watcherFn(this);
      oldValue = watcher.last;
      if (!this.$$areEqual(newValue, oldValue, watcher.compareByValue)) {
        dirty = true;
        this.$$lastDirtyWatcher = watcher;
        watcher.listenerFn(newValue, oldValue, this);
        watcher.last = watcher.compareByValue ? _.cloneDeep(newValue) : newValue;
      } else if (this.$$lastDirtyWatcher === watcher) {
        return false; //return false in a lodash loop causes it to break
      }
    }.bind(this));

    return dirty;
  };

  this.$$areEqual = function(newValue, oldValue, compareByValue) {
    if (compareByValue) return _.isEqual(newValue, oldValue);
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
  };
}

module.exports = Scope;
