pipeline {
  agent {
    docker {
      image 'python:3.11'     // Python already installed here
      args  '-u root:root'    // Run as root to install software
    }
  }

  options {
    timestamps()
    ansiColor('xterm')
  }

  parameters {
    string(name: 'DOCKER_REGISTRY', defaultValue: 'docker.io', description: 'Docker registry domain')
    string(name: 'DOCKER_REPO', defaultValue: 'yourdockerusername', description: 'DockerHub username')
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Deploy to Kubernetes?')
    string(name: 'K8S_NAMESPACE', defaultValue: 'default', description: 'K8s Namespace')
  }

  environment {
    BUILD_TAG = "${env.BUILD_NUMBER ?: 'local'}"
    BACKEND_DIR = 'backend'
    FRONTEND_DIR = 'frontend'
    DOCKER_CREDENTIALS_ID = 'docker-credentials'
    KUBECONFIG_CREDENTIALS_ID = 'kubeconfig'
  }

  stages {

    stage('Install Node & Tools') {
      steps {
        sh """
          apt update
          apt install -y curl gnupg
          curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
          apt install -y nodejs
          curl -LO https://storage.googleapis.com/kubernetes-release/release/v1.20.0/bin/linux/amd64/kubectl
          chmod +x kubectl
          mv kubectl /usr/local/bin/
        """
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Backend: Install requirements') {
      steps {
        dir(env.BACKEND_DIR) {
          sh 'pip install -r requirements.txt'
        }
      }
    }

    stage('Frontend: Install & Build') {
      steps {
        dir("${env.FRONTEND_DIR}/client") {
          sh 'npm ci'
          sh 'npm run build'
        }
      }
    }

    stage('Docker Build') {
      steps {
        script {
          env.BACKEND_IMAGE = "${params.DOCKER_REGISTRY}/${params.DOCKER_REPO}/loan-backend:${env.BUILD_TAG}"
          env.FRONTEND_IMAGE = "${params.DOCKER_REGISTRY}/${params.DOCKER_REPO}/loan-frontend:${env.BUILD_TAG}"

          sh "docker build -t ${env.BACKEND_IMAGE} ${env.BACKEND_DIR}"
          sh "docker build -t ${env.FRONTEND_IMAGE} ${env.FRONTEND_DIR}"
        }
      }
    }

    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh "echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin ${params.DOCKER_REGISTRY}"
          sh "docker push ${env.BACKEND_IMAGE}"
          sh "docker push ${env.FRONTEND_IMAGE}"
        }
      }
    }

    stage('Deploy to Kubernetes') {
      when {
        expression { return params.DEPLOY }
      }
      steps {
        withCredentials([file(credentialsId: env.KUBECONFIG_CREDENTIALS_ID, variable: 'KUBECONFIG_FILE')]) {
          sh 'mkdir -p $HOME/.kube'
          sh 'cp $KUBECONFIG_FILE $HOME/.kube/config'

          sh "kubectl -n ${params.K8S_NAMESPACE} set image deployment/backend backend=${env.BACKEND_IMAGE}"
          sh "kubectl -n ${params.K8S_NAMESPACE} set image deployment/frontend frontend=${env.FRONTEND_IMAGE}"
        }
      }
    }
  }

  post {
    success { echo 'Pipeline Succeeded' }
    failure { echo 'Pipeline Failed' }
  }
}
