lint:
	eslint lib test

testnode:
	mocha

ci: lint testnode

deploy-all: guard-STAGE
	./scripts/deployAll.sh $(STAGE)

deploy-all-dev:
	STAGE=dev make deploy-all

deploy-all-prod:
	STAGE=production make deploy-all

deploy-function: guard-FUNCTIONNAME guard-STAGE
	./scripts/deployFunction.sh $(FUNCTIONNAME) $(STAGE)

deploy-startlist: guard-STAGE
	FUNCTIONNAME=startList make deploy-function

deploy-startlist-dev:
	STAGE=dev make deploy-startlist

deploy-startlist-prod:
	STAGE=production make deploy-startlist

deploy-overallresults: guard-STAGE
	FUNCTIONNAME=overallResults make deploy-function

deploy-overallresults-dev:
	STAGE=dev make deploy-overallresults

deploy-overallresults-prod:
	STAGE=production make deploy-overallresults

deploy-results: guard-STAGE
	FUNCTIONNAME=results make deploy-function

deploy-results-dev:
	STAGE=dev make deploy-results

deploy-results-prod:
	STAGE=production make deploy-results

deploy-validateresults:

deploy-resultdetails:

# Use guard-ENVIRONMENT_VARIABLE name when your tasks require an environment
# variable to be set as a pre-requisite
guard-%:
	@ if [ "${${*}}" == "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi
