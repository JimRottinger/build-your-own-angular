'use strict';

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$watch = function(watcherFn, listenerFn) {
    this.$$watchers.push({
      watcherFn: watcherFn,
      listenerFn: listenerFn
    });
  };

  this.$digest = function() {
    var newValue, oldValue;
    _.each(this.$$watchers, function(watcher){
      newValue = watcher.watcherFn(this);
      oldValue = watcher.last;
      if (newValue !== oldValue) {
        watcher.listenerFn(newValue, oldValue, this);
        watcher.last = newValue;
      }
    }.bind(this));
  };
}

module.exports = Scope;
