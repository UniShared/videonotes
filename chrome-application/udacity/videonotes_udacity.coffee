class File
    constructor: (videoUrl) ->
        return {
            content: ""
            video: videoUrl
            syncNotesVideo:
              enabled: true
            labels:
              starred: false
            editable: true
            title: "Untitled notes"
            description: ""
            mimeType: "application/vnd.unishared.document"
            parent: null
        }

class Editor
    constructor: (container) ->
        init(container)

    init = (container) ->
        @file = new File()
        @dirty = false
        @saving = false
        create(container)
        bindEvents()
        autoSave()

    create = (container) ->
      element = document.createElement("div")
      element.id = "editor"
      element.style.position = "absolute"
      element.style.top = "33px"
      element.style.right = 0
      element.style.bottom = 0
      element.style.left = 0
      element.style.height = "195px"

      container.style.position = 'relative'
      container.appendChild(element)

      @editor = ace.edit element
      return

    bindEvents = ->
        session = @editor.getSession()
        session.on "change", (=>
            @dirty = true
            @file.content = session.getValue()
            if not @ytplayer
                @ytplayer =new YT.Player($('iframe')[0])
            return
        )

    autoSave = ->
        if @dirty && not @saving
            @file.video = 'http://www.youtube.com/watch?v='+$('iframe').attr('src').split('?')[0].split('/')[4]
            @saving = true
            console.log "Saving"
            $.ajax(
              type: if @file.id then "PUT" else "POST"
              url: "http://local.videonot.es:8080/svc"
              params:
                newRevision: true

              data: JSON.stringify(@file)
              contentType: "application/json; charset=utf-8"
              dataType: "json"
            ).done((result) =>
              console.log "saved"
              @file.id = result.id
              @dirty = false
              @saving = false
              return
            ).fail (result) ->
              console.log "error"

        setTimeout autoSave, 5000



class VideoNotesUdacity
    init: ->
        container = document.body.querySelector("#additional-materials").getElementsByClassName("span6")[1]
        container.getElementsByTagName('h2')[0].innerHTML = "Your VideoNot.es"
        editor = new Editor(container)

app = new VideoNotesUdacity()
app.init()

window.onYouTubeIframeAPIReady = ->
    console.log "Ready"
