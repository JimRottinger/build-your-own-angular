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
