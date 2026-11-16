source("research-pipeline/engine.R")
dir.create("artifacts",showWarnings=FALSE)
requests<-list()
for(model in c("bernoulli","binomial","geometric","poisson","normal","exponential","gamma","rayleigh"))for(mode in if(model=="normal")c("mean","variance","both")else "unknown")for(family in c("conjugate","reference")) {
 requests[[length(requests)+1L]]<-list(model=model,mode=mode,n=2500,seed=2026,level=.95,scale="variance",gen=list(p=.4,m=10,rate=2,shape=3,mean=5,variance=30,scale=2),prior=list(family=family,a=2,b=3,m=0,v=10,k=1))
}
requests[[length(requests)+1L]]<-within(requests[[length(requests)-1L]],scale<-"sigma")
fixtures<-lapply(requests,function(r)list(request=r,result=run_request(r)))
writeLines(encode_json(fixtures),"artifacts/parity-fixtures.json",useBytes=TRUE)
cat(length(fixtures),"native R parity fixtures generated.\n")
