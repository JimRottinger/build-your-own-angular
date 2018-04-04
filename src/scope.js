"use strict";

var _ = require("lodash");

function isArrayLike(obj) {
  if (_.isNull(obj) || _.isUndefined(obj)) {
    return false;
  }
  var length = obj.length;
  return (
    length === 0 || (_.isNumber(length) && length > 0 && length - 1 in obj)
  );
}

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
  this.$$listeners = {};

  this.$new = function(isolated, parent) {
    var child;
    parent = parent || this;

    var ChildScope = function() {
      this.$$watchers = [];
      this.$$children = [];
      this.$$listeners = {};
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
      listenerFn: listenerFn || function() {},
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

    var destroyFunctions = _.map(watcherFnList, function(watcherFn, i) {
      return self.$watch(watcherFn, function(newValue, oldValue) {
        newValues[i] = newValue;
        oldValues[i] = oldValue;

        if (!changeReactionScheduled) {
          changeReactionScheduled = true;
          self.$evalAsync(watchGroupListener);
        }
      });
    });

    return function() {
      _.forEach(destroyFunctions, function(fn) {
        fn();
      });
    };
  };

  this.$watchCollection = function(watchFn, listenerFn) {
    var newValue, oldValue, oldLength, veryOldValue;
    var trackVeryOldValue = listenerFn.length > 1;
    var changeCount = 0;
    var firstRun = true;

    var internalWatchFn = function(scope) {
      var newLength;

      newValue = watchFn(scope);
      if (_.isObject(newValue)) {
        if (isArrayLike(newValue)) {
          if (!_.isArray(oldValue)) {
            changeCount++;
            oldValue = [];
          }
          if (newValue.length !== oldValue.length) {
            changeCount++;
            oldValue.length = newValue.length;
          }
          _.forEach(newValue, function(newItem, i) {
            var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
            if (!bothNaN && newItem !== oldValue[i]) {
              changeCount++;
              oldValue[i] = newItem;
            }
          });
        } else {
          if (!_.isObject(oldValue) || isArrayLike(oldValue)) {
            changeCount++;
            oldValue = {};
            oldLength = 0;
          }
          newLength = 0;
          _.forOwn(newValue, function(newVal, key) {
            newLength++;
            if (oldValue.hasOwnProperty(key)) {
              var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
              if (!bothNaN && oldValue[key] !== newVal) {
                changeCount++;
                oldValue[key] = newVal;
              }
            } else {
              changeCount++;
              oldLength++;
              oldValue[key] = newVal;
            }
          });
          if (oldLength > newLength) {
            changeCount++;
            _.forOwn(oldValue, function(oldVal, key) {
              if (!newValue.hasOwnProperty(key)) {
                oldLength--;
                delete oldValue[key];
              }
            });
          }
        }
      } else {
        if (!this.$$areEqual(newValue, oldValue, false)) {
          changeCount++;
        }
        oldValue = newValue;
      }

      return changeCount;
    }.bind(this);

    var internalListenerFn = function() {
      if (firstRun) {
        listenerFn(newValue, newValue, this);
        firstRun = false;
      } else {
        listenerFn(newValue, veryOldValue, this);
      }

      if (trackVeryOldValue) {
        veryOldValue = _.clone(newValue);
      }
    }.bind(this);

    return this.$watch(internalWatchFn, internalListenerFn);
  };

  this.$beginPhase = function(phase) {
    if (this.$$phase) {
      throw this.$$phase + " already in progress";
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
    this.$beginPhase("$digest");

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
          console.error("Error in $asyncQueue: ", e);
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
    this.$$everyScope(
      function(scope) {
        var newValue, oldValue;
        _.forEachRight(
          scope.$$watchers,
          function(watcher) {
            if (watcher) {
              try {
                newValue = watcher.watcherFn(scope);
                oldValue = watcher.last;
                if (
                  !scope.$$areEqual(newValue, oldValue, watcher.compareByValue)
                ) {
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
          }.bind(this)
        );
        return continueLoop;
      }.bind(this)
    );

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

  this.$$postDigest = function(fn) {
    this.$$postDigestQueue.push(fn);
  };

  this.$$areEqual = function(newValue, oldValue, compareByValue) {
    if (compareByValue) return _.isEqual(newValue, oldValue);
    return (
      newValue === oldValue ||
      (typeof newValue === "number" &&
        typeof oldValue === "number" &&
        isNaN(newValue) &&
        isNaN(oldValue))
    );
  };

  this.$eval = function(fn, locals) {
    return fn(this, locals);
  };

  this.$apply = function(fn, locals) {
    this.$beginPhase("$apply");
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
      setTimeout(
        function() {
          if (this.$$asyncQueue.length) this.$root.$digest();
        }.bind(this),
        0
      );
    }

    this.$$asyncQueue.push({
      scope: this,
      fn: fn
    });
  };

  this.$applyAsync = function(fn) {
    this.$$applyAsyncQueue.push(
      function() {
        this.$eval(fn);
      }.bind(this)
    );

    if (!this.$root.$$applyAsyncId) {
      this.$root.$$applyAsyncId = setTimeout(
        function() {
          this.$apply(_.bind(this.$$flushApplyAsync, this));
        }.bind(this),
        0
      );
    }
  };

  this.$$flushApplyAsync = function() {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()();
      } catch (e) {
        console.error("Error in $applyAsync: ", e);
      }
    }
    this.$root.$$applyAsyncId = null;
  };

  this.$$flushPostDigestQueue = function() {
    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()();
      } catch (e) {
        console.error("Error in $$postDigest: ", e);
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

  this.$on = function(eventName, listener) {
    var listeners = this.$$listeners[eventName];
    if (!listeners) {
      this.$$listeners[eventName] = listeners = [];
    }
    listeners.push(listener);

    return function() {
      var index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners[index] = null;
      }
    };
  };

  this.$emit = function(eventName) {
    var propagationStopped = false;
    var eventObject = {
      name: eventName,
      targetScope: this,
      stopPropagation: function() {
        propagationStopped = true;
      },
      preventDefault: function() {
        eventObject.defaultPrevented = true;
      }
    };
    var listenerArgs = [eventObject].concat(_.tail(arguments));
    var scope = this;
    do {
      eventObject.currentScope = scope;
      scope.$$fireEventOnScope(eventName, listenerArgs);
      scope = scope.$parent;
    } while (scope && !propagationStopped);
    eventObject.currentScope = null;
    return eventObject;
  };

  this.$broadcast = function(eventName) {
    var eventObject = {
      name: eventName,
      targetScope: this,
      preventDefault: function() {
        eventObject.defaultPrevented = true;
      }
    };
    var listenerArgs = [eventObject].concat(_.tail(arguments));
    this.$$everyScope(function(scope){
      eventObject.currentScope = scope;
      scope.$$fireEventOnScope(eventName, listenerArgs);
      return true;
    });
    eventObject.currentScope = null;
    return eventObject;
  };

  this.$$fireEventOnScope = function(eventName, listenerArgs) {
    var listeners = this.$$listeners[eventName] || [];
    var i = 0;
    while (i < listeners.length) {
      if (listeners[i] === null) {
        listeners.splice(i, 1);
      } else {
        listeners[i].apply(null, listenerArgs);
        i++;
      }
    }
  };
}

module.exports = Scope;
