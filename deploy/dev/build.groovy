try{
    node {
        stage 'Checkout'
            git url: 'git@prod-git.coursehero.com:coursehero/service/theia.git', branch: BRANCH

        // until Jenkin's docker is >=17.05, use dockerception
        stage 'Build / Test'
            sh 'docker run --rm -e DOCKER_API_VERSION=1.22 -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD":/theia -w /theia docker:18 \
                  docker build \
                  --build-arg node_env=development \
                  -t 315915642113.dkr.ecr.us-east-1.amazonaws.com/dev-theia .'

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
