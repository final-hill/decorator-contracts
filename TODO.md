Prevent delete

============

@override needs to test input for use in non-TS environments. assert(isFunction) and such

does an @override member return a value as expected?

==========
async method handling?
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch

=============
overrides
	writable | configurable | enumerable verification

Does the typescript 4.3 override feature not cover these use cases? Therefore does not subsume this
library feature?

=========
	• https://web.archive.org/web/20151205005155/https://blog.mozilla.org/dherman/2011/08/29/contracts-coffee/
	• https://web.archive.org/web/20151002033716/http://c2.com/cgi/wiki?DesignByContract
	• https://en.wikipedia.org/wiki/Code_contract
	• https://web.archive.org/web/20150905075048/http://users.eecs.northwestern.edu/~robby/pubs/papers/ho-contracts-techreport.pdf
	• https://cstheory.stackexchange.com/questions/5228/relationship-between-contracts-and-dependent-typing?newreg=666f3092f1644974935c5ca8436097c4
	• https://mobile.twitter.com/graydon_pub/status/1045674497271988230
	• http://homepages.inf.ed.ac.uk/wadler/topics/blame.html
	• http://www.drdobbs.com/architecture-and-design/ada-2012-ada-with-contracts/240150569
https://web.archive.org/web/20150905075048/http://users.eecs.northwestern.edu/~robby/pubs/papers/ho-contracts-techreport.pdf

====

Contracts and variance
contracts vs unit tests
unit tests vs type systems

====
Are Contracts and Unit Tests dual?

====================
@demands

{Be liberal in what you accept, and conservative in what you give}

===========
https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions

===========

Unit testing is one thing, but a test plan is needed as well to show that the library can be installed and used in another library

===============

versioning:

I should be able to know what version of code I have from the code itself and not have to look at the branch tag

Also don't want to have to manually tag in multiple places

Version dictated by build/release only?

================

"A class is not simply an interface. ":

Stack vs Queue interface 

========
	
competitor/comparable
https://github.com/alexreardon/tiny-invariantcompare with other contract libraries
	https://en.wikipedia.org/wiki/Design_by_contract

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

=============

Russian Doll Pattern vs N-version programming (page 426 of OOSC 2nd Ed.)

===================

Object-oriented Software Construction
	page 121
	"""
	It is not the job of a stack module to deal with error messages,
	which are a user interface issue. Stack modules should deal with the 
	efficient implementation of stack operations. To keep the body of top
	simple and convincing, the precondition not empty must be assumed
	"""

===============
Document difference from Eiffel
https://stackoverflow.com/questions/57694623/is-the-rescue-clause-being-called-on-descendent-redefinition


=======
https://wiki.c2.com/?DesignByContract
https://en.wikipedia.org/wiki/Design_by_contract
https://en.wikipedia.org/wiki/Exception_handling#Exception_handling_based_on_design_by_contract
https://www.eiffel.com/values/design-by-contract/introduction/

=============
https://news.ycombinator.com/item?id=705715
http://web.archive.org/web/20190128011444/https://zedshaw.com/archive/why-i-algpl/
https://hn.algolia.com/?query=GPL&sort=byPopularity&prefix&page=0&dateRange=all&type=story

=========
https://www2.cs.duke.edu/courses/fall07/cps108/papers/ocp.pdf

https://stackoverflow.com/questions/8155850/how-to-test-whether-a-set-is-reflexive-symmetric-anti-symmetric-and-or-transit?rq=1
https://math.stackexchange.com/questions/2164422/how-to-find-binary-representation-of-sets

======

Relationship between specification and verification?

====

compare with boost contract library
https://www.boost.org/doc/libs/develop/libs/contract/doc/html/boost_contract/contract_programming_overview.html

=======

https://www.microsoft.com/en-us/research/project/code-contracts/?from=http%3A%2F%2Fresearch.microsoft.com%2Fen-us%2Fprojects%2Fcontracts%2Ffaq.aspx 
https://docs.microsoft.com/en-us/archive/blogs/francesco/faq-1-what-is-the-difference-between-assert-and-assume 
https://github.com/dotnet/csharplang/issues/105 

=========

https://www.eiffel.org/doc/eiffel/ET-_Design_by_Contract_%28tm%29%2C_Assertions_and_Exceptions

==========
https://web.archive.org/web/20151220045527/http://disnetdev.com/contracts.coffee
https://web.archive.org/web/20151002175109/http://eschertech.com/papers/safe_oo_software.pdf
==========

https://docs.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts
https://www.dotnetcurry.com/csharp/1172/code-contracts-csharp-static-runtime-checks
https://en.wikipedia.org/wiki/Design_by_contract
https://en.wikipedia.org/wiki/Invariant_(mathematics)#cite_ref-4
are invariants == axioms?

Research paper:
	Object-Oriented First-Order Logic by Eyal Amir
	Association with Requirements

=========

https://dry-rb.org/gems/dry-schema/1.5/
https://www.microsoft.com/en-us/research/project/code-contracts/?from=http%3A%2F%2Fresearch.microsoft.com%2Fen-us%2Fprojects%2Fcontracts%2Ffaq.aspx
