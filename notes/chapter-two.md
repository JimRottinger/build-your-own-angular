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

## `$evalAsync` - Deferred Execution

Often time in JavaScript, we want to defer the execution of a function to some point in the future when the current execution context has finished. The usual way to do this is by calling `setTimeout` with a zero delay parameter. This same pattern applies in Angular as well, though the preferred way to do it is by using the $timeout service which integrates the delayed function to the digest cycle with $apply.

The other way to defer code in Angular is through the $evalAsync function on scopes. It takes a function and schedules it to run later but still during the ongoing digest. This is often preferable to $timeour with zero delay because of the browser event loop. $timeout inherently relinquishes control to the browser and lets it decide when to schedule work. $evalAsync, on the other hand, is gauranteed to execute during the ongoing digest cycle which happens in the same process on the event loop.
