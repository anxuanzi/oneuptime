#!/usr/bin/env bash

echo "Connect machine with to communicate with aws cluster"
# This command will automatically switch to the fyipe-staging cluster
aws eks update-kubeconfig --region us-east-2 --name fyipe-staging
