try{
    node {
        stage 'Checkout'
            git url: 'git@prod-git.coursehero.com:coursehero/service/theia.git', branch: 'master'

        stage 'Build / Test'
            sh 'docker build \
                  --build-arg theia_env=production \
                  -t 315915642113.dkr.ecr.us-east-1.amazonaws.com/theia .'

        stage 'Push'
            sh "eval \$(aws ecr get-login)"
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
