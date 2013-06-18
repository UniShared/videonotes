class ConfigSingleton
	# You can add statements inside the class definition
	# which helps establish private scope (due to closures)
	# instance is defined as null to force correct scope
	instance = null
	# Create a private class that we can initialize however
	# defined inside this scope to force the use of the
	# singleton class.
	class Config
		load: ->
			promise = $.getJSON chrome.extension.getURL('/config.json') 
			promise.done (config) => 
				@.config = config

			return promise

	# This is a static method used to either retrieve the
	# instance or create a new one.
	@get: ->
		instance ?= new Config()
