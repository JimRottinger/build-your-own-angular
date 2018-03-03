# Chapter 1 - Scopes and Dirty Checking

## Scope Objects

In Angular, scopes can be created by applying the `new` operator to the `Scope` constructor. The result is a plain old JavaScript object (POJO). Because it is simply a POJO, we attach properties to it by calling `.property = `. There are no special setters or getters that you need to call, nor restrictions on what values you assing.

## Watching Object Properties: $watch and $digest

`$watch` and `$digest` work together to form the core of what the digest cycle is all about - reacting to changes in data. With `$watch`, you can attached something called a watcher to the scope and that is something that is notified when a change in the scope occurs. The watch function should return a piece of data that we are interested in, usually something that exists on the Scope. For this reason, the scope is usually passed into the watcher function as an argument.

It should be noted that, usually, when assigning watchers, you provide a watch expression such as `model.value` instead of a watch function. Under the hood, the angular parser unpacks the expression into a watcher function for you.

The second argument of `$watch` is the listener function that will be called whenever the data changes. As for `$digest`, it iterates over all of the watchers that have been attached to the scope and runs their watch and listener functions accordingly. It's job is to call each watch function and compare its return value to whatever the same function returned the last time. If the values differ, the watch is dirty and its listener function should be called.

Watchers get registered to the scope under the `$$watchers` property. The double-dollar prefix signifies that this variable should be considered proviate to the Angular framework code.

Here is our minimal implementation of angular scope, watch, and digest so far:

```js
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
```

Knowing this, we can gather a couple points about the performance of Angular. First of all, attaching a property to the scope does not have an impact on performance because the digest cycle iterates over the watchers and not the scope properties. Secondly, watch watch function is called during every digest cycle.

## Initializing Watch Values
