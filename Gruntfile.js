module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: '<json:package.json>',
        watch: {
            compass: {
                files: [ 'static/scss/*.scss' ],
                tasks: [ 'compass:dev' ]
            },
            karma: {
                files: ['static/js/*.js', 'test/unit/*.js'],
                tasks: ['karma:unitBackground:run'] //NOTE the :run flag
            }
        },
        karma: {
            options: {
                configFile: 'config/karma.conf.js',
                browsers: ['Chrome', 'Firefox']
            },

            unit: {
                singleRun: true
            },

            unitBackground: {
                background: true
            }
        },
        uglify: {
            options: {
                sourceMap: 'static/js/build/videonotes.min.map.js',
                sourceMappingURL: '/js/build/videonotes.min.map.js'
            },
            build: {
                files: {
                    'static/js/build/tmp/app.min.js': [
                        'static/lib/bootstrap-tour/bootstrap-tour.js',
                        'static/lib/bootstrap-switch/bootstrapSwitch.js',
                        'static/lib/bootstrap-tour/deps/jquery.cookie.js',
                        'static/js/app.js', 'static/js/controllers.js', 'static/js/directives.js', 'static/js/filters.js', 'static/js/services.js'
                    ]
                }
            }
        },
        concat: {
            js: {
                src: ['static/lib/ace/ace.min.js', 'static/lib/angular-ui-custom/angular-ui.min.js', 'static/lib/modernizr-custom/modernizr.min.js', 'static/lib/angular-youtube/build/angular-youtube-player-api.min.js', 'static/lib/angular-gaq/build/angular-gaq.min.js','static/js/build/tmp/app.min.js'],
                dest: 'static/js/build/videonotes.min.js'
            },
            css: {
                src: ['static/css/app.css', 'static/css/font-awesome.css', 'static/lib/bootstrap-switch/bootstrapSwitch.css'],
                dest: 'static/css/build/tmp/concat.css'
            }
        },
        cssmin: {
            build: {
                src: 'static/css/build/tmp/concat.css',
                dest: 'static/css/build/videonotes.min.css'
            }
        },
        clean: {
            tmp: {
                src: ['static/css/build/tmp/*', 'static/js/build/tmp/*'],
                filter: 'isFile'
            }
        },
        compass: {
            dev: {
                src: 'static/scss',
                dest: 'static/css',
                linecomments: true,
                forcecompile: true,
                debugsass: true
            },
            prod: {
                src: 'static/scss',
                dest: 'static/css',
                outputstyle: 'compressed',
                linecomments: false,
                forcecompile: true,
                debugsass: false
            }
        }
    });

    // Loading external tasks
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-css');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-compass');
    grunt.loadNpmTasks('grunt-karma');

    // Default task.
    grunt.registerTask('prod', ['uglify', 'compass:prod', 'concat', 'cssmin', 'clean']);
    grunt.registerTask('default', ['prod']);

};