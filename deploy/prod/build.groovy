def silent_sh(cmd) {
    println "running silent sh: $cmd"
    sh('#!/bin/sh -e\n' + cmd)
}

try{
    node {
        stage 'Checkout'
            if("true" == "${FORCE_CLEAR_GIT_WORKSPACE}") {
              echo "Force clearing Git workspace"
              sh 'docker run --rm --net="host" -v /var/lib/jenkins/jobs/Build-Theia:/root/Build-Theia:rw -i 315915642113.dkr.ecr.us-east-1.amazonaws.com/scriptbox:php7.1 rm -fr /root/Build-Theia/workspace/*'
            }
            git url: 'git@prod-git.coursehero.com:coursehero/service/theia.git', branch: 'master'

        stage 'Build / Test'
            sh 'docker build \
                  --build-arg theia_env=production \
                  -t 315915642113.dkr.ecr.us-east-1.amazonaws.com/theia .'

        stage 'Push'
            silent_sh "eval \$(aws ecr get-login)"
            sh "docker push 315915642113.dkr.ecr.us-east-1.amazonaws.com/theia:latest"

        stage 'Release'
            dir('./deploy/prod') {
                withCredentials([[$class: 'UsernamePasswordMultiBinding', credentialsId: 'e9f12036-e7eb-4cec-a9d8-aa1a2517318d', passwordVariable: 'RANCHER_SECRET_KEY', usernameVariable: 'RANCHER_ACCESS_KEY']]) {
                    sh 'ch-deploy deploy theia'
                    sh 'ch-deploy scale theia'
                }
            }
    }
}
catch (err){
    error "Build Failed"
}
