# Chapter 1 - Scopes and Dirty Checking

Scope is one of Angular's central building blocks and is used for many purposes:

 - Sharing data between a controller/directive and its view template
 - Sharing data between different parts of the UI
 - Broadcasting and listening for events
 - Watching for changes in data

Of these, the watching for changes in value is the most interesting and the one that almost all JavaScript frameworks solve in some way. Angular scopes implement dirty-checking and you can get notified when a piece of data on the scope changes. It is the secret-sauce of data binding and that is what we will be focusing on in the first part of this tutorial

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

### Initializing Watch Values

When we initially wrote the digest function, it compared the new value of the scope property to last value of that same property when the digest cycle ran. This works well enough, but it does not work for the first digest cycle because our first `last` value will be `undefined` and the first new value might very well be `undefined` because that is a valid value. In this case, however, our comparison will fail and the listener function will not execute. We need a better initial value.

Instead of setting the initial watch value to `undefined`, we can set it to an empty function since functions are so-called *reference values* meaning that they are not equal to anything except themself.

### Keeping The Digest Going While It Stays Dirty

The basics of our implementation is in place, however, the case we haven't covered yet is one in which the listener function changes the value of the property on the scope. This is a common case to want to transform a user input after they have entered it, or change one property based on another. However, if another watcher is looking at the same value as one that just changed changed, it might not notice the change during the same digest pass. That being said, we have to ensure we trigger chained watchers in the same digest. Consider the following test code:

```js
it('triggers chained watchers in the same digest', function() {
  scope.name = "Jim";

  scope.$watch(
    function(scope) { return scope.nameUpper },
    function(newValue, oldValue, scope) {
      if (newValue) {
        scope.initial = newValue.substring(0,1) + '.';
      }
    }
  );

  scope.$watch(
    function(scope) { return scope.name },
    function(newValue, oldValue, scope) {
      if (newValue) {
        scope.nameUpper = newValue.toUpperCase();
      }
    }
  );

  scope.$digest();
  expect(scope.initial).toEqual('J.');

  scope.name = 'Bob';
  scope.$digest();
  expect(scope.initial).toEqual('B.');
});
```

The test is designed to deliberately order the watchers in such a way that the first watcher will not be called when the second watcher updates the value that the first is watching. However, we would like the watchers to not have to care about the order in which they are run and for the listener function to run on the same digest cycle if the value has been changed. To fix this, we have to modify the digest function to iterate through all of the watchers until their watched values have stopped changing.

To implement this, we need each digest to return whether or not it found a dirty value, and to run it until it stops being dirty.

```js
this.$digest = function() {
  var dirty;
  do {
    dirty = this.$$digestOnce();
  } while (dirty)
};
```

Angular scopes don't actually have a $$digestOnce function. Instead, they are all nested within $digest, however, it makes the code more readable to extract it out into its own function.

Based on what we have just learned, it is easy to observe that our watchers may be run many times during each digest pass. For this reason, each watcher should be idempotent - meaning it has no side effects, or at least no side effects that can happen any number of times. You should also not set up your watchers such that they will run infinitely in a caircular manner.

### Giving Up on an Unstable Digest

The situation just described in which the digest runs infinitely is called an unstable digest. In this situation, what we want to do is run the digest for a number of iterations and then eventually throw an exception. The maximum number of iterations is called the Time to Live, or TTL. By default, it is 10. It is possible to adjust it but, at that point, the software design can proabably be better.

```js
this.$digest = function() {
  var dirty, iterations;
  iterations = 0;
  do {
    dirty = this.$$digestOnce();
    iterations++;
    if (dirty && iterations >= this.TTL) throw "Max digests exceeded";
  } while (dirty);
};
```

### Short-Circuiting the Digest when the Last Watch is Clean

As it stands now, we are iterating over every single watcher and if even one of them is dirty, all of them will run again. One optimization that we can make is to shirt-circuit the remainder of the watches when the last watch becomes clean. To do so, we can simply keep track of the last watcher that was dirty and, then, for each subsequent clean pass, if it matched the previously dirty one, we know that one full cycle has passed and we can exit early. Here is our test case for these to show what we mean:

```js
it('ends the digest when the last watch is clean', function() {
  scope.array = _.range(100);
  var watchExecutions = 0;

  _.times(100, function(i) {
    scope.$watch(
      function(scope) {
        watchExecutions++;
        return scope.array[i];
      },
      function (newValue, oldValue, scope) { }
    );
  });

  scope.$digest();
  expect(watchExecutions).toEqual(200);

  watchExecutions = 0;
  scope.array[0] = 9999;
  scope.$digest();
  expect(watchExecutions).toEqual(101);

  watchExecutions = 0;
  scope.array[0] = -9999;
  scope.array[49] = 9999;
  scope.$digest();
  expect(watchExecutions).toEqual(150)
});
```

This test is solid, however, it does not cover the case of new watchers being added during the digest cycle - something that is possible. This is easily fixed by resetting the last dirty watcher when a new watcher is added.

These changes may not seem like the biggest of optimizations, however, it is significant enough on average that the Angular team included it in the framework.

### Value-Based Dirty-Checking

Now we are going to talk about how values actually get compared to detech that something has changed. Thus far, we have simply been using the `===` operator, which only works on primitives or when an object or array changes to a new one. Angular, however, is able to detect a change from within an object or array. That is, you can watch for changes in value, not just in reference. This kind of dirty checking is activated bu providing a third, optional boolean flag to the $watch function that, when true, value-based is used.

Angular ships with its own equal checking function, but we’re going to use the one provided by Lo-Dash instead because it does everything we need. We also need to change the way we are storing the old value because it is not enough to simply store a reference to the current value because then any changes to that value will not be noticed. Instead, we have to make a deep copy of it. Lodash can help us here as well with the `cloneDeep` function.

```js
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
  return newValue === oldValue;
};
```

Angular does not do deep, value checking by default because it is an expensive operation. If it is possible to do so, you should watch a specific property instead of the entire structure.

There is a third type of dirty checking mechanism in Angular called Collection Watching, but we will cover that in Chapter 3.

### NaNs are Weird

In JavaScript, NaN (not a number) is not equal to itself. This comes directly from the IEEE standard for floating point numbers. Therefore, we need to explicitly handle it in our dirty-checking function. If not, a NaN value will will always be dirty.

```js
this.$$areEqual = function(newValue, oldValue, compareByValue) {
  if (compareByValue) return _.isEqual(newValue, oldValue);
  return newValue === oldValue ||
    (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
};
```

### Handling Exceptions

The dirty checking we have implemented thus far is starting to resemble Angular's, however, it is very brittle. We are allowing developers to define their own watch and listener functions and then not performing any exception handling. If even one exception occurs, the entire cycle will break.

## Summary



## Quiz

## Quiz Answers