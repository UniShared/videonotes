angular-smoothscroll
====================

An AngularJS directive to get a smooth scroll effect (like this: http://css-tricks.com/examples/SmoothPageScroll/)

#How to use it?

1. Build Coffeescript `grunt coffee:dist`
2. Copy generated JS in .tmp folder and include it
3. Add the dependency to your app `app.module('myApp', ['angularSmoothscroll'])`
4. Declare an HTML the link element which start scroll and the target `<a smooth-scroll target="target">Scroll to Target</a>`
5. You can declare the offset (default is 100): `<a smooth-scroll target="target" offset="30">Scroll to Target</a>`

#How to contribute?

1. Clone this repo
2. Make your changes
3. Test them: `grunt test`
4. Open a pull-request

Powered by AngularJS (http://angularjs.org), Yeoman (http://yeoman.io), Grunt (http://gruntjs.com) and Karma (http://karma-runner.github.io/0.8/index.html)