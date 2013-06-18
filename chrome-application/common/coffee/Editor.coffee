class Editor
    constructor: (container, id, title) ->
      @backend = new Backend()
      @dirty = true
      @saving = false
      editorElm = @_createHTML(container)

      promiseConfig = ConfigSingleton.get().load()

      if id
        promiseConfig.done => @_load(id) 
      else
        @backend.create(title)
        @_updateEditor()
        promiseConfig.done (event, config) => @_autoSave()

      @ytPlayer = new YoutubePlayer()

      return editorElm      

    _createHTML: (container) ->
      @editorElm = document.createElement("div")
      @editorElm.id = "videonotes-editor"

      container.appendChild(@editorElm)

      @editor = ace.edit @editorElm
      @editor.setReadOnly(true)
      session = @editor.getSession()
      session.setUseWrapMode true 
      session.setWrapLimitRange 33

      return @editorElm

    _load: (id) ->
      promiseFile = @backend.load(id)
      promiseFile.done ((result)=> 
        @_dispatchEvent 'videonotes::loaded', {resourceUrl: ConfigSingleton.get().config.BASE_URL + '/edit/' + result.id}
        @_updateEditor()
        @_autoSave()
      )

    _getCurrentSync: ->
      if @backend.info.videos[@backend.info.currentVideo]
        @backend.info.videos[@backend.info.currentVideo]
      else if @backend.info.currentVideo
        @backend.info.videos[@backend.info.currentVideo] = {}
      else
        null

    _syncLine: (session, line) ->
      # Is there a video loaded?
      currentSync = @_getCurrentSync()
      if @backend.info and @backend.info.currentVideo        
        # Is there some texts before and after?
        timestampBefore = undefined
        isLineBefore = false
        timestampAfter = undefined
        isLineAfter = false
        session.setBreakpoint line
        for lineSynced of currentSync
          if not isLineBefore and lineSynced < line
            isLineBefore = true
            timestampBefore = currentSync[lineSynced]
          else if not isLineAfter and lineSynced > line
            isLineAfter = true
            timestampAfter = currentSync[lineSynced]
          break  if isLineBefore and isLineAfter
        if isLineBefore and isLineAfter
          
          # Text before and after
          # Timestamp for this line must be average time between nearest line before/after
          currentSync[line] = (timestampBefore + timestampAfter) / 2
        else
          
          # No text or only before / after
          # Using current player time minus a delta
          currentSync[line] = @ytPlayer.currentTime or 0.01
        console.log "Setting timestamp", line, currentSync[line], "on", @backend.info.currentVideo
      
      # No video => mark it anyway, don't want to sync this line
      else
        console.log "No video"
        currentSync[line] = -1

    _unsync: (session, line) ->
      currentSync = @_getCurrentSync()
      if @backend.info and currentSync and line of currentSync
        session.clearBreakpoint line
        delete currentSync[line]

    _updateBreakpoints: (session) ->
      if session and @backend.info
        session.clearBreakpoints()
        for sync of @backend.info.videos
          for line of sync
            session.setBreakpoint line  if @backend.info.videos[sync][line] > -1

    _updateEditor: ->
      return unless @backend.info
      console.info "Updating editor", @backend.info
      
      EditSession = require("ace/edit_session").EditSession
      session = new EditSession(@backend.info.content)

      session.$changeListener = =>
        @dirty = true
        @backend.info.content = session.getValue()
        @backend.info.currentVideo = @ytPlayer.getCurrentVideoURL()

        return
      session.on 'change', session.$changeListener

      session.$breakpointListener = (e) =>
        currentSync = @_getCurrentSync()
        return if not @backend.info or not currentSync
        delta = e.data
        range = delta.range
        if range.end.row is range.start.row
          if session.getLine(range.start.row).trim() is ""
            @_unsync session, range.start.row
          else @_syncLine session, range.start.row  unless range.start.row of currentSync

        firstRow = undefined
        shift = undefined
        if delta.action is "insertText"
          firstRow = (if range.start.column then range.start.row + 1 else range.start.row)
          shift = 1
        else
          firstRow = range.start.row
          shift = -1
        shiftedSyncNotesVideo = {}
        for line of currentSync
          intLine = parseInt(line)
          unless isNaN(intLine)
            if line < firstRow
              shiftedSyncNotesVideo[line] = currentSync[line]
            else
              nextLine = parseInt(line) + shift
              shiftedSyncNotesVideo[nextLine] = currentSync[line]
        currentSync = shiftedSyncNotesVideo
        @_updateBreakpoints session
      session.on "change", session.$breakpointListener

      @backend.info.lastSave = 0
      @_updateBreakpoints session
      @editor.setSession session
      session.setUseWrapMode true
      session.setWrapLimitRange 33
      @editor.focus()
      @editor.setReadOnly not @backend.info.editable

      return

    _autoSave: ->
        if @dirty and not @saving
            console.log "Saving", @backend.info
            @saving = true
            firstSave = not @backend.info.id
            promise = @backend.save()
            promise.done (result) =>
              if firstSave
                @_dispatchEvent('videonotes::firstSaved', {resourceUrl: ConfigSingleton.get().config.BASE_URL + '/edit/' + result.id})
                
              @dirty = false
              @saving = false
              return
            promise.fail (result) =>
              console.log "error", result.status
              @editor.setReadOnly false
              @saving = false
              return

        setTimeout (=> @_autoSave()), 5000

    _dispatchEvent: (name, args) ->
      evt = new CustomEvent(name)
      evt.data = args

      @editorElm.dispatchEvent evt

