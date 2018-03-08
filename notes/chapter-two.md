# Chapter 2 - Scope Methods

In Chapter 1, we implemented basic dirty-checking, $watch, and $digest. Now, we are going to turn our attention to expanding the methods on the scope. We'll add several ways one can access scopes and evaluate scope to cause dirty checking to be triggered.

## `$eval` - Evaluating Code in the Context of a Scope

In Angular, `$eval` is a method on the scope that allows you to execute a function in the context of that scope. It takes a function as an argument and immediately executes it, giving it the scope itself as an argument.

```js
scope.$eval(function(scope){
	//do something with the scope
});
```

The implementation of `$eval` is incredibly simple, so what's the point of it? First of all, using `$eval` makes it very explicit that a piece of code is dealing specifically with the contents of the scope. In addition, it is a building block for `$apply`, which we will see next. Also later on, we will see the most interesting use of `$eval` which is when we can give it an expression and compile it into a function that executes in the context of the scope.

## `$apply` - Integrating External Code with the Digest Cycle

`$apply` takes a function as an argument. It executes that function using `$eval`, and then kickstarts
the digest cycle by invoking $digest. It is considered the standard way to integrate external libraries to Angular.

## `$evalAsync` - Deferred Execution and Scope Phases

Often time in JavaScript, we want to defer the execution of a function to some point in the future when the current execution context has finished. The usual way to do this is by calling `setTimeout` with a zero delay parameter. This same pattern applies in Angular as well, though the preferred way to do it is by using the $timeout service which integrates the delayed function to the digest cycle with $apply.

The other way to defer code in Angular is through the $evalAsync function on scopes. It takes a function and schedules it to run later but still during the ongoing digest. This is often preferable to $timeour with zero delay because of the browser event loop. $timeout inherently relinquishes control to the browser and lets it decide when to schedule work. $evalAsync, on the other hand, is gauranteed to execute during the ongoing digest cycle which happens in the same process on the event loop.

Another thing that `$evalAsync` does it to schedule a `$digest` if one isn't already ongoing. This assures you that whenever you call this function that the work you're deferring will be invoked very soon. However, even though `$evalAsync` does schedule a digest, the preferred way to asynchronously execute code within a digest is with `$applAsync` which we will see soon.

It was just stated that evalAsync schedules a digest if one isn't already going. That implies that we need some sort of way to know whether or not a digest is currently running. For this purpose, Angular scopes implement something called a _phase_, which is simply a string attribute on the scope that stores information about what is going on. These phases are going to be `$digest`, `$apply`, and `null`. To help us test asynchronous code, we can use Jasmine's `done` function which can be passed into `beforeEach`, `it`, and `afterEach` as a single argument and hten called when the async work is complete. Here is what our new function looks like:

```js
this.$evalAsync = function(fn) {
  if (!this.$$phase && !this.$$asyncQueue.length) {
    setTimeout(function() {
      if (this.$$asyncQueue.length) this.$digest();
    }.bind(this), 0);
  }
  this.$$asyncQueue.push({
    scope: this,
    fn: fn
  });
};
```

Note that we check the length of the current async queue in two places here:

1. Before calling setTimeout because we don't want ot call setTimeout more than we need to. If there's already something in the queue, we already have a timeout set and it will eventually drain the queue
2. Inside the setTimeout function we make sure that the queue is not empty. That is because we don't want ot kick off a digest unnecessarily if we have nothing to do.

If you call $evalAsync when a digest is already running, your function will be evaluated during that digest. If there is no digest running, one is started.
