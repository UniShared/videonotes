describe "smoothscroll", ->
  ###
  Retrieve the current vertical position
  @returns Current vertical position
  ###

  currentYPosition = ->
    # Firefox, Chrome, Opera, Safari
    return self.pageYOffset  if self.pageYOffset
    
    # Internet Explorer 6 - standards mode
    return document.documentElement.scrollTop  if document.documentElement and document.documentElement.scrollTop
    
    # Internet Explorer 6, 7 and 8
    return document.body.scrollTop  if document.body.scrollTop
    0


  beforeEach module('angularSmoothscroll')

  beforeEach inject(($rootScope, $compile) ->
    @anchor = angular.element("<a smooth-scroll target=\"target\"></a>")
    @target = angular.element("<div id=\"target\" style=\"position:absolute; top:200px;\"></div>")

    scope = $rootScope.$new()
    $compile(@anchor) scope
    scope.$digest()

    $('body').append @target
  )

  it "should scroll to target", inject(($timeout) ->
    expect(currentYPosition()).toEqual 0
    @anchor[0].click()
    waitsFor (->
        console.log currentYPosition()
        currentYPosition() == 100
        ), "Current position to be 100px"

    runs ->
        expect(currentYPosition()).toEqual 100
   )

