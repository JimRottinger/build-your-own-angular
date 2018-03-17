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
  this.$root = this;
  this.$$phase = null;
  this.$$children = [];

  this.$new = function(isolated, parent) {
    var child;
    parent = parent || this;

    var ChildScope = function() {
      this.$$watchers = [];
      this.$$children = [];
      this.$parent = parent;
    };
    ChildScope.prototype = this;

    if (isolated) {
      child = new Scope();
      child.$root = parent.$root;
      child.$$asyncQueue = parent.$$asyncQueue;
      child.$$postDigestQueue = parent.$$postDigestQueue;
      child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    } else {
      child = new ChildScope();
    }

    parent.$$children.push(child);
    return child;
  };

  this.$watch = function(watcherFn, listenerFn, compareByValue) {
    compareByValue = compareByValue ? true : false;
    this.$root.$$lastDirtyWatcher = null;

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
        this.$root.$$lastDirtyWatcher = null;
      }
    }.bind(this);
  };

  this.$watchGroup = function(watcherFnList, listenerFn) {
    var self = this;
    var newValues = new Array(watcherFnList.length);
    var oldValues = new Array(watcherFnList.length);
    var changeReactionScheduled = false;
    var firstRun = true;

    if (watcherFnList.length === 0) {
      var shouldRun = true;
      self.$evalAsync(function() {
        if (shouldRun) listenerFn(newValues, oldValues, self);
      });
      return function() {
        shouldRun = false;
      };
    }

    function watchGroupListener() {
      if (firstRun) {
        firstRun = false;
        listenerFn(newValues, newValues, self);
      } else {
        listenerFn(newValues, oldValues, self);
      }
      changeReactionScheduled = false;
    }

    var destroyFunctions = _.map(watcherFnList, function(watcherFn, i){
      return self.$watch(watcherFn, function(newValue, oldValue){
        newValues[i] = newValue;
        oldValues[i] = oldValue;

        if (!changeReactionScheduled) {
          changeReactionScheduled = true;
          self.$evalAsync(watchGroupListener);
        }
      });
    });

    return function() {
      _.forEach(destroyFunctions, function(fn){
        fn();
      });
    };
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
    this.$root.$$lastDirtyWatcher = null;
    this.$beginPhase('$digest');

    if (this.$root.$$applyAsyncId) {
      clearTimeout(this.$root.$$applyAsyncId);
      this.$$flushApplyAsync();
    }

    do {
      while (this.$$asyncQueue.length) {
        try {
          var asyncTask = this.$$asyncQueue.shift();
          asyncTask.scope.$eval(asyncTask.fn);
        } catch (e) {
          console.error('Error in $asyncQueue: ', e);
        }
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
    var dirty;
    var continueLoop = true;
    this.$$everyScope(function(scope) {
      var newValue, oldValue;
      _.forEachRight(scope.$$watchers, function(watcher){
        if (watcher) {
          try {
            newValue = watcher.watcherFn(scope);
            oldValue = watcher.last;
            if (!scope.$$areEqual(newValue, oldValue, watcher.compareByValue)) {
              dirty = true;
              this.$root.$$lastDirtyWatcher = watcher;
              watcher.last = watcher.compareByValue ? _.cloneDeep(newValue) : newValue;
              watcher.listenerFn(newValue, oldValue, scope);
            } else if (this.$root.$$lastDirtyWatcher === watcher) {
              continueLoop = false;
              return false; //return false in a lodash loop causes it to break
            }
          } catch (e) {
            console.error(e);
          }
        }
      }.bind(this));
      return continueLoop;
    }.bind(this));

    return dirty;
  };

  this.$$everyScope = function(fn) {
    if (fn(this)) {
      return this.$$children.every(function(child) {
        return child.$$everyScope(fn);
      });
    } else {
      return false;
    }
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
      this.$root.$digest();
    }
    this.$clearPhase();
  };

  this.$evalAsync = function(fn) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      setTimeout(function(){
        if (this.$$asyncQueue.length) this.$root.$digest();
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

    if (!this.$root.$$applyAsyncId) {
      this.$root.$$applyAsyncId = setTimeout(function(){
        this.$apply(_.bind(this.$$flushApplyAsync, this));
      }.bind(this), 0);
    }
  };

  this.$$flushApplyAsync = function() {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()();
      } catch (e) {
        console.error('Error in $applyAsync: ', e);
      }
    }
    this.$root.$$applyAsyncId = null;
  };

  this.$$flushPostDigestQueue = function() {
    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()();
      } catch (e) {
        console.error('Error in $$postDigest: ', e);
      }
    }
  };

  this.$destroy = function() {
    if (this.$parent) {
      var siblings = this.$parent.$$children;
      var indexOfThis = siblings.indexOf(this);
      if (indexOfThis >= 0) {
        siblings.splice(indexOfThis, 1);
      }
    }
    this.$$watchers = null;
  };
}

module.exports = Scope;
