class VideoNotes
    init: ->
        @_createHtml()
        
    _createHtml: ->
        styleFontAwesome = document.createElement 'link' 
        styleFontAwesome.rel = "stylesheet"
        styleFontAwesome.type = "text/css"
        styleFontAwesome.href = chrome.extension.getURL("lib/font-awesome/css/font-awesome.min.css")
        (document.head or document.documentElement).appendChild styleFontAwesome

        @container = document.createElement 'div'
        @container.id = 'videonotes-container'
        @container.className = 'ui-widget-content'
        @container.style.top = (document.querySelector('.player-body').offsetTop + (document.querySelector('.player-body'). clientHeight/2)) + "px"

        @_createHeadHTML()
        @_createBodyHTML()

        document.body.appendChild @container
        $(@container).draggable { cancel: "#videonotes-body, .videonotes-start, .videonotes-feedback" }

        @_bindEvents()

    _createHeadHTML: ->
        head = document.createElement 'div'
        head.id = 'videonotes-head'
        @container.appendChild head

        headLeft = document.createElement 'div'
        headLeft.className = 'head-left'

        headRight = document.createElement 'div'
        headRight.className = 'head-right'

        # Logo
        logo = document.createElement 'img'
        logo.className = 'logo'
        logo.src = chrome.extension.getURL('img/icon-32.png')
        logo.alt = 'VideoNot.es'
        logo.style.display = 'inline-block'

        logoLink = document.createElement 'a'
        logoLink.href = 'http://videonot.es'
        logoLink.target = '_blank'
        logoLink.appendChild logo

        # Start VideoNot.es link
        startLink = document.createElement 'a'
        startLinkTitle = document.createElement('h3')
        startLink.className = 'videonotes-start'
        startLinkTitle.innerHTML = 'Start a VideoNot.es' 
        startLink.appendChild startLinkTitle
        startLink.float = "left"

        # Feedback link
        feedbackLink = document.createElement 'a'
        feedbackLink.href = 'http://feedback.videonot.es'
        feedbackLink.className = 'videonotes-feedback'
        feedbackLink.target = '_blank'
        feedbackLink.innerHTML = 'Feedback/support' 
        feedbackLink.float = "left"

        headLeft.appendChild logoLink
        headLeft.appendChild startLink
        headLeft.appendChild feedbackLink

        # Move icon
        moveIcon = document.createElement 'i'
        moveIcon.className = 'icon-move icon-large'

        # Collapse icon
        collapseIcon = document.createElement 'i'
        collapseIcon.className = 'icon-collapse-alt icon-large videonotes-collapse'

        headRight.appendChild collapseIcon
        headRight.appendChild moveIcon

        head.appendChild headLeft
        head.appendChild headRight
        return

    _createBodyHTML: ->
        body = document.createElement 'div'
        body.id = 'videonotes-body'
        @container.appendChild body
        return

    _getUrlParams: ->
        # Retrieve URL parameters
        prmstr = window.location.search.substr(1)
        prmarr = prmstr.split("&")
        params = {}
        i = 0
        while i < prmarr.length
          tmparr = prmarr[i].split("=")
          params[tmparr[0]] = tmparr[1]
          i++

        return params

    _bindEvents: ->
        maxHeight = '150px'
        startLink = @container.querySelector('.videonotes-start')
        startLinkTitle = startLink.getElementsByTagName('h3')[0]
        editorContainer = @container.querySelector('#videonotes-body')
        collapseIcon = @container.querySelector('.videonotes-collapse')

        readyListener = (e) =>
            startLinkTitle.innerHTML = 'Open in VideoNot.es'
            startLink.href = e.data.resourceUrl
            startLink.target = "_blank"  

        clickListener = (fileId) =>
            # Callback to wait ends of transition, otherwise editor does not take the correct height
            transitionEnd = => 
                @container.removeEventListener 'webkitTransitionEnd', transitionEnd
                title = 'Udacity - ' + document.body.getElementsByClassName('player-head')[0].getElementsByTagName('h1')[0].innerHTML

                editor = new Editor(editorContainer, fileId, title)

                if fileId
                    editor.addEventListener 'videonotes::loaded', readyListener
                else
                    editor.addEventListener 'videonotes::firstSaved', readyListener
            
            @container.addEventListener 'webkitTransitionEnd', transitionEnd, false
            @container.style.height = maxHeight

            collapseIcon.style.display = 'inline'
            collapseIcon.addEventListener 'click', =>
                if collapseIcon.classList.contains('icon-collapse-alt')
                    editorContainer.style.height = '0%'
                    @container.style.height = '50px'
                    collapseIcon.classList.remove('icon-collapse-alt')
                    collapseIcon.classList.add('icon-expand-alt')
                else
                    editorContainer.style.height = '55%'
                    @container.style.height = maxHeight
                    collapseIcon.classList.remove('icon-expand-alt')
                    collapseIcon.classList.add('icon-collapse-alt')  

            if fileId 
                startLinkTitle.innerHTML = 'Loading...'
            else
                startLinkTitle.innerHTML = 'Creating...'

        params = @_getUrlParams()

        # If start_videonotes params, start directly
        if params.videonotes_start and params.videonotes_start == '1'
            clickListener params.videonotes_id
        else 
            startLink.addEventListener 'click', -> 
                startLink.removeEventListener 'click', arguments.callee 
                clickListener()
        return 

window.addEventListener 'load', (->
    app = new VideoNotes()
    app.init()
)