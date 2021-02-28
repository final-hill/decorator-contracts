Test the interception subclass method calls 

===================
multiple rescues on a feature?
defined per error type? all errors?

=============================
cleanup TODOs
=======
Prevent delete

intercept property assignments
=======

test method.apply and method.call
	current methods w/ contracts applied to other class
	other class method applied to contracted class
============

@override

@override needs to test input for use in non-TS environments. assert(isFunction) and such

test for @override assigned to class

does an @override member return a value as expected?

======================
	only a single @rescue can be assigned to a feature
invariant required

@staticRescue can be assigned to a class or its static features
	when assigned to a class it will act as the @static rescue for all of its static features
		including the constructor
	
	subclasses also use this @staticRescue
	
	only a single @rescue can be assigned to a feature
	invariant required

Inheritance?

===================

Change Request
change the use of 'member' in documentation to class 'feature'
======================

	// FIXME: if debugMode on invariant and prod mode on
	// other decorators? Need to update unit tests
==========
async method handling?
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch

=========

can COntractHandler be refactored into template pattern at least in part?

=========

if the class member is checkMode and the invariant is prodMode?

==========
@invariant on Base class

@invariant on SubClass
=============
overrides
	writable | configurable | enumerable verification

===================
review typings folder usage

===================

member vs class feature

==================
COntracted class methods can not use method.apply(...)?
	or can apply/call be captured and the contracts disabled?

otherClass.apply(contractedClass)
	how is invariant applied? can proxy capture?

Foo.prototype.method.apply(other)

What invariant applies?

====================
@demands

{Be liberal in what you accept, and conservative in what you give}
{Encoding of error checking}
{Complicates implementation}
{All of this extraneous checking has nothing to do with the datastructure}

==============

If @invariant comes from checkMode=false and @demands comes from checkMode true, what happens?
vice-versa?

=======

test @demands w/ params


=========

simplify tests by refactoring requirement to "member decorator" terminology

===========

LSP
http://www.blackwasp.co.uk/LSP.aspx

===========
https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions

=========

SHow documentation example of timing requirements

======

{Philosophically speaking: when the user of a class one of its features they are required 
to fulfill its defined preconditions. After the feature has completed its execution the defined 
postcondition is fulfilled. }

===========

Unit testing is one thing, but a test plan is needed as well to show that the library can be installed and used in another library

=============
implement a Predicate builder instead of passing functions to enable early-errors?

let StackContracts = new AssertionBuilder((self: Stack<any>) => {
    notEmpty() { self. }
})

@invariant
class Stack {
  ...
  @demands(StackContracts.notEmpty)
  pop(){ ... }
  ...
}
=========

3 step inheritance and restoreFeatures method => getAncestorRegistry 	
	
	parent has registry. registry does not have entry for feature.
	grandparent also has registry with the entry for the feature.
	
	the entry is therefore not restored properly...

============
`Precondition failed on ${Clazz.name}.${String(propertyKey)}`

Should display the precondition:

`Precondition failed on ${Clazz.name}.${String(propertyKey)} : ${precondition.toString()}`

THe message is also innacurate. It should say ${Clazz.name}.prototype.${String(propertyKey)}

===============

versioning:

I should be able to know what version of code I have from the code itself and not have to look at the branch tag

Also don't want to have to manually tag in multiple places

Version dictated by build/release only?

=======

Test Contracted() on intermediary class

Test Contracted on Contracted class


incompatible contracts?
	base class Contract vs subclass contract

================

"A class is not simply an interface. ":

Stack vs Queue interface 

"Contracts specify the semantics of a class..."
============
The description of @override should immediately follow @invariant so that it's not used before being defined

============
Test getter/setter on @demands

=============

Test contracts on async methods, constructors, etc

===================
override decorator line 83 - 85
else do what?

================
competitor/comparable
https://github.com/alexreardon/tiny-invariant

=============
Add further reading section to README

========
	
compare with other contract libraries
	https://en.wikipedia.org/wiki/Design_by_contract
===============
update release name format
https://dev.azure.com/thenewobjective/decorator-contracts/_releaseDefinition?definitionId=3&_a=definition-options
https://dev.azure.com/thenewobjective/decorator-contracts/_git/ddacbfd1-8e95-4067-8b9c-95324bac6926/commit/c20d4263b7f0b6301179141ac2bd81c0ba9130a1
==============

See badges of https://github.com/parcel-bundler/parcel

==============

Strengthening/weakening in contract subtypes:

"""
The notions of “stronger” and “weaker” are formally defined from logic: P1 is said to be
stronger than P2, and P2 weaker than P1, if P1 implies P2 and they are not equal. As every
proposition implies True, and False implies every proposition, it is indeed legitimate to
speak of True as the weakest and False as the strongest of all possible assertions.
""" -- meyer p. 358

in LSP:
"""
Preconditions cannot be strengthened in a subtype.
Postconditions cannot be weakened in a subtype.
Invariants of the supertype must be preserved in a subtype.
	https://softwareengineering.stackexchange.com/questions/364713/liskov-principle-subclasses-can-have-stronger-invariants-how-could-it-work
History constraint (the "history rule"). Objects are regarded as being
	modifiable only through their methods (encapsulation). Because subtypes may 
	introduce methods that are not present in the supertype, the introduction 
	of these methods may allow state changes in the subtype that are not 
	permissible in the supertype. The history constraint prohibits this. It 
	was the novel element introduced by Liskov and Wing. A violation of this 
	constraint can be exemplified by defining a mutable point as a subtype of 
	an immutable point. This is a violation of the history constraint, because 
	in the history of the immutable point, the state is always the same after 
	creation, so it cannot include the history of a mutable point in general. 
	Fields added to the subtype may however be safely modified because they are
	not observable through the supertype methods. Thus, one can derive a circle 
	with fixed center but mutable radius from immutable point without violating LSP.
"""
How to enforce? @invariant proxy should be able to catch this...


https://en.wikipedia.org/wiki/Liskov_substitution_principle

================
Add branching rules to Contributing.md

Business opportunity?
https://marketplace.visualstudio.com/search?term=Contributor%20License%20Agreement&target=AzureDevOps&category=All%20categories&sortBy=Relevance


https://www.typescriptlang.org/play/index.html?experimentalDecorators=true#code/AISwdgbghgTiVgC4ApkGcCmAbAZgLgAIBlRKAYwGsBKAgXgD4DkBvAKAI4LRAC8MBhLFAC2ABwwATQgAYCAHlpdsOAHTc+BAGSaluNbwzzFmPVhDCQiADTtOGMYgCeACShoAcgHsiBwidUgaACiDo7INLSK6Mr6GpEE0lQ2nAQ4AK5YWACSaACCiAAy5pZ+MYEAYhlY4XRR-rGG8fVmFohUrAC+VO1kQmhoxKSUBGwplvYAKo7iAISECI6sthyiMJ6IGGQbEgQA+uaiWPYYSFCIIJ5ghLkwMFCOcogAFoEA2gBE48JT4u8AuoxFK8-ksUmRLmhEDA0ltPDBkDAMFAJJcsI4CC0SgQwGlhAAjDAwGjMDqgziBEKiJzhQh4zyeI4IEbLFIERGINIwMAEZ6BFT7MRHYQnUjnS4qI5gADmz1qCRZpJZFSqNIIdIZSO5o1ZHHZnO5vLQ-IOQpFZwuYAlJxlTzlholxUQCrJHGAiIAjmkQIi0Kh-IQSORqHRGCwWSkwOtKU5CDN6hTQuEFd0WcATmhORhfdFcAGhhQrARYFK0IRgYWGVJBkGIqHtTrI4hKplY-G0M3qklw5x1BgACKbRHCpCl3SqXtyysNAgAWgIAEZk+0UqJPKJVYaPl8fhh-sydbqMByuTyXkaBYdjqcxZbV+uqDNnamPV6fX7lHmayGmPXWY2O62ZTtiqy6cF0oGuummbZv61aUIWrxfH8ZaBpQrwAOTbtMGDoX8fwVlgVaocGDA-t2HCNtGjiAXoCZUmEXYHgQohpGgTySDkExrqUeiIGuNSRIoXzJAevZZGAZBDiKo71BO8RThOADUC5LiyLFscgXyEJumEbN82G4VQhAQJ4IA7L+KT2heprXhaKjqU8ml6RBBCKikUpHlwBiqji+KEvuB56ieVkmleop2ZKNpPikboYJ63pZu+uZwSRdbkdi6wAQQcZAR2SYpOBLJ8fe2lnhhWHiLhAU6kFBpnsagphealyvCFjXDuF4qRbKc7zn8ADczodEAA

==========
cleanup TODOs

=================

inline asserts should not be used for things like null checking because...

=============

Russian Doll Pattern vs N-version programming (page 426 of OOSC 2nd Ed.)

===================
Notify:
	https://github.com/microsoft/TypeScript/issues/2000
	
============
class Stack<T> {
	...
	@require(self => !self.isEmpty()
	top(): T {
		if(this.isEmpty()) {
			console.log('The Stack is empty');
			// throw 'The stack is empty' ?
		} else {
			...
		}
	}
}

Object-oriented Software Construction
	page 121
	"""
	It is not the job of a stack module to deal with error messages,
	which are a user interface issue. Stack modules should deal with the 
	efficient implementation of stack operations. To keep the body of top
	simple and convincing, the precondition not empty must be assumed
	"""
	
===========
What about static methods?

object invariants?

function invariants?


==========
prevent duplicate empty @invariant

@invariant
class Base {}

@invariant
class Sub extends Base {}

===============
Document difference from Eiffel
https://stackoverflow.com/questions/57694623/is-the-rescue-clause-being-called-on-descendent-redefinition

==============
"""
Precondition violations are reported to the caller. They indicate a bug in the caller. 
If bugs are expected or possible in the callers, you can catch and handle them in the callers.

Postcondition violations are reported to the callee. They indicate bugs in the callee. 
The callee can catch and handle them if such bugs are expected.

Class invariants are established at object creation. If they are violated by the creation 
procedure or after the execution of a procedure used in a qualified call, they indicate a bug 
in the callee and can be handled like postcondition violations. Otherwise, they indicate more 
complex issue involving object dependencies. It could be handled by the caller, but most likely 
it would be next to impossible to restore correct object state.
"""

=======
https://wiki.c2.com/?DesignByContract
https://en.wikipedia.org/wiki/Design_by_contract
https://en.wikipedia.org/wiki/Exception_handling#Exception_handling_based_on_design_by_contract
https://www.eiffel.com/values/design-by-contract/introduction/

=============
https://news.ycombinator.com/item?id=705715
http://web.archive.org/web/20190128011444/https://zedshaw.com/archive/why-i-algpl/
https://hn.algolia.com/?query=GPL&sort=byPopularity&prefix&page=0&dateRange=all&type=story

================
https://docs.microsoft.com/en-us/azure/devops/artifacts/get-started-npm?view=azure-devops&tabs=windows
https://www.twilio.com/blog/2017/06/writing-a-node-module-in-typescript.html

=========
https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle
https://www2.cs.duke.edu/courses/fall07/cps108/papers/ocp.pdf

https://stackoverflow.com/questions/8155850/how-to-test-whether-a-set-is-reflexive-symmetric-anti-symmetric-and-or-transit?rq=1
https://math.stackexchange.com/questions/2164422/how-to-find-binary-representation-of-sets