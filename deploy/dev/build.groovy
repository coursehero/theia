try{
    node {
        stage 'Checkout'
            git url: 'git@prod-git.coursehero.com:coursehero/service/theia.git', branch: BRANCH

        // stage 'Ready Parameters'
        //     sh "touch /var/filecabinet/devops/shared/dev-service-study-guide-data/PARAMS_BEING_USED"
        //     sh "cp /var/filecabinet/devops/shared/dev-service-study-guide-data/parameters.yml config/parameters.yml"

        stage 'Yarn Install'
            sh 'docker run --rm -v ~/.ssh:/root/.ssh -v $(pwd):/var/build -w /var/build node:carbon /bin/bash -c "yarn install"'

        stage 'Yarn Build'
            sh 'docker run --rm -v ~/.ssh:/root/.ssh -v $(pwd):/var/build -w /var/build node:carbon /bin/bash -c "yarn run build"'

        // stage 'Save Parameters'
        //     sh "cp config/parameters.yml /var/filecabinet/devops/shared/dev-service-study-guide-data/parameters.yml"
        //     sh "rm -f /var/filecabinet/devops/shared/dev-service-study-guide-data/PARAMS_BEING_USED"

        stage 'Tests'
            sh 'docker run --rm -v ~/.ssh:/root/.ssh -v $(pwd):/var/build -w /var/build node:carbon /bin/bash -c "yarn run test"'

        stage 'Build'
            sh "docker build --build-arg NODE_ENV=development -t 315915642113.dkr.ecr.us-east-1.amazonaws.com/dev-theia ."

        stage 'Push'
            sh "eval \$(aws ecr get-login)"
            sh "docker push 315915642113.dkr.ecr.us-east-1.amazonaws.com/dev-theia:latest"

        stage 'Release'
            dir('./deploy/dev') {
                withCredentials([[$class: 'UsernamePasswordMultiBinding', credentialsId: '8e3f6ee6-5f8b-451f-a279-2a614b26c19a', passwordVariable: 'RANCHER_DEV_SECRET_KEY', usernameVariable: 'RANCHER_DEV_ACCESS_KEY']]) {
                    sh 'ch-deploy deploy theia --dev'
                    sh 'ch-deploy scale theia --dev'
                }
            }
    }
}
catch (err){
    error "Build Failed"
}
