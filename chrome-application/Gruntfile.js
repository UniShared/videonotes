module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-config');
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-contrib-coffee');
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-coffeelint');
    grunt.loadNpmTasks('grunt-contrib-cssmin');


    grunt.initConfig({
      dest: 'build/<%= grunt.config.get("environment") %>',
      pkg: '<json:package.json>',
      meta: {
        banner: '/*! <%=pkg.name%> - v<%=pkg.version%> (build <%=pkg.build%>) - '+
               '<%=grunt.template.today("dddd, mmmm dS, yyyy, h:MM:ss TT")%> */'
      },
      config: {
        local: {
          options: {
            variables: {
              'environment': 'local'
            }
          }
        },
        staging: {
          options: {
            variables: {
              'environment': 'staging'
            }
          }
        },
        production: {
          options: {
            variables: {
              'environment': 'production'
            }
          }
        }
      },
      clean: {
        build:["<%=dest%>"],
        release: ['<%=dest%>/js/videonotes-chrome.js', '<%=dest%>/css/styles.css']
      },
      coffeelint: {
        app: ['common/coffee/*.coffee'] 
      },
      coffee: {
        app: {
          options: {
            join: true
          },
          files: {
            '<%=dest%>/js/videonotes-chrome.js': ['common/coffee/*.coffee'] // 1:1 compile
          }
        }
      },   
      uglify: {
        js: {
          files: {
            '<%=dest%>/js/videonotes-chrome.min.js': '<%=dest%>/js/videonotes-chrome.js',
          }
        }
      },
      sass: {                                 
        app: {         
            files: { 
                '<%=dest%>/css/styles.css': 'common/scss/styles.scss'
            }
        }
      },
      cssmin: {
        minify: {
          files: {
            '<%=dest%>/css/styles.min.css': '<%=dest%>/css/styles.css'
          }
        }
      },
      copy: {
        lib: {
          files: {
            '<%=dest%>/' : 'lib/**/*'
          }
        },
        img: {
          files: [
            {expand: true, flatten: true, src: ['common/img/*'], dest: '<%=dest%>/img', filter: 'isFile'}
            ]
        },
        manifest: {
          files: [
            {expand: true, flatten: true, src: ['<%= grunt.config.get("environment") %>/*'], dest: '<%=dest%>', filter: 'isFile'}
          ] 
        }
      },
      zip: {
        app: {
          cwd: '<%=dest%>',
          src: ['<%=dest%>/**/*'],
          dest: '<%=dest%>/videonotes-<%= grunt.config.get("environment") %>.zip' 
        }
      },
      watch: {
        scripts: {
          files: ['common/coffee/*.coffee', 'common/scss/*.scss', '<%= grunt.config.get("environment") %>/manifest.json'],
          tasks: ['package:local'],
          options: {
            nospawn: true,
          }
        }
      }
    });

    grunt.registerTask('build', ['clean:build', 'coffee', 'sass']);
    grunt.registerTask('min', ['uglify', 'cssmin']);
    grunt.registerTask('package', ['copy', 'zip']);
    grunt.registerTask('package:local', ['config:local' , 'build', 'copy']);
    grunt.registerTask('package:staging', ['config:staging', 'build', 'min', 'clean:release', 'package']);
    grunt.registerTask('package:prod', ['config:production', 'build', 'min', 'clean:release', 'package']);

    grunt.registerTask('default', ['package:local', 'package:staging', 'package:prod']);
};

