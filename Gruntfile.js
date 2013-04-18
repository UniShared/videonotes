module.exports = function (grunt) {
    // Loading external tasks
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-compass');
    grunt.loadNpmTasks('grunt-karma');

    // Project configuration.
    grunt.initConfig({
        dist: 'build',
        pkg: grunt.file.readJSON('package.json'),
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
            build: {
                files: [
                    {
                        'static/js/<%= dist %>/tmp/external.min.js': [
                            'static/lib/angular-ui-custom/angular-ui.js',
                            'static/lib/bootstrap-tour/bootstrap-tour.js',
                            'static/lib/bootstrap-switch/bootstrapSwitch.js',
                            'static/lib/bootstrap-tour/deps/jquery.cookie.js'
                        ]
                    },
                    {
                        'static/js/<%= dist %>/tmp/app.min.js': [
                            'static/js/app.js',
                            'static/js/controllers.js',
                            'static/js/directives.js',
                            'static/js/filters.js',
                            'static/js/services.js'
                        ]
                    }
                ]
            }
        },
        concat: {
            options: {
                stripBanners: true,
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */'
            },
            js: {
                src: ['static/lib/ace/ace.min.js',
                    'static/lib/angular-ui-bootstrap-custom/ui-bootstrap-custom-tpls-0.3.0.min.js',
                    'static/lib/modernizr-custom/modernizr.min.js', 'static/lib/detectizr/detectizr.min.js',
                    'static/lib/angular-youtube/<%= dist %>/angular-youtube-player-api.min.js',
                    'static/lib/angular-gaq/<%= dist %>/angular-gaq.min.js', 'static/js/<%= dist %>/tmp/external.min.js', 'static/js/<%= dist %>/tmp/app.min.js'],
                dest: 'static/js/<%= dist %>/<%= pkg.name %>.min.js'
            },
            css: {
                src: ['static/lib/bootstrap-switch/bootstrapSwitch.css', 'static/css/app.css'],
                dest: 'static/css/<%= dist %>/tmp/concat.css'
            }
        },
        cssmin: {
            combine: {
                files: {
                    'static/css/<%= dist %>/<%= pkg.name %>.min.css': ['<%= concat.css.dest %>']
                }
            }
        },

        clean: {
            build: {
                src: ['static/css/<%= dist %>/*', 'static/js/<%= dist %>/*'],
                filter: 'isFile'
            },
            tmp: {
                src: ['static/css/<%= dist %>/tmp/*', 'static/js/<%= dist %>/tmp/*'],
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

    // Default task.
    grunt.registerTask('prod', ['clean:build','uglify', 'compass:prod', 'concat', 'cssmin', 'clean:tmp']);
    grunt.registerTask('default', ['prod']);

};