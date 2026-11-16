source('research-pipeline/engine.R')
dir.create('artifacts',showWarnings=FALSE)
cases<-list();results<-list();failures<-character()
for(model in c('bernoulli','binomial','geometric','poisson','exponential','gamma','rayleigh','normal'))
for(mode in if(model=='normal') c('mean','variance','both') else 'unknown')
for(prior in c('ordinary','conflicting','weak','reference'))
for(n in c(20,100,500,1000,2500)) {
 r<-list(model=model,mode=mode,n=n,seed=2026,level=if(n==20).99 else .95,scale='variance',gen=list(p=.05,m=10,rate=2,shape=3,mean=5,variance=30,scale=2),prior=list(family=if(prior=='reference')'reference' else 'conjugate',a=2,b=3,m=0,v=10,k=1))
 if(prior=='conflicting')r$prior<-modifyList(r$prior,if(model%in%c('bernoulli','binomial','geometric'))list(a=9900,b=100) else if(model%in%c('poisson','exponential','gamma'))list(a=10000,b=10) else list(a=1000,b=999000,m=-100,v=.0001,k=10000))
 if(prior=='weak')r$prior<-modifyList(r$prior,list(a=.1,b=.1,v=1e6,k=.001))
 id<-paste(model,mode,prior,n,sep='/')
 tryCatch({out<-run_request(r);stopifnot(out$status=='posterior')
   for(p in out$panels){d<-p$posterior;ci<-p$summary$interval
    cdf<-function(t)switch(d$type,beta=pbeta(t,d$a,d$b),gamma=pgamma(t,d$a,rate=d$b),ig=pgamma(1/t,d$a,rate=d$b,lower.tail=FALSE),normal=pnorm(t,d$m,sqrt(d$v)),student=pt((t-d$m)/sqrt(d$v),d$df))
    stopifnot(abs(cdf(ci$upper)-cdf(ci$lower)-r$level)<1e-7,length(p$curve$x)>10,all(is.finite(unlist(p$curve))),all(diff(p$curve$x)>0),all(p$curve$y>=0),length(p$shade$x)>1,all(p$shade$x>=ci$lower),all(p$shade$x<=ci$upper))
    # Check Bayes' identity independently using original likelihood and prior kernels.
    if(prior!='reference' && mode!='both'){
     t<-dq(d,c(.2,.4,.6,.8));lp<-switch(model,bernoulli=dbinom(sum(out$sample$values),n,t,log=TRUE),binomial=dbinom(sum(out$sample$values),n*r$gen$m,t,log=TRUE),geometric=n*log(t)+sum(out$sample$values)*log1p(-t),poisson=sum(out$sample$values)*log(t)-n*t,exponential=n*log(t)-t*sum(out$sample$values),gamma=n*r$gen$shape*log(t)-t*sum(out$sample$values),rayleigh=-n*log(t)-sum(out$sample$values^2)/(2*t),normal=if(mode=='mean')vapply(t,function(mu)sum(dnorm(out$sample$values,mu,sqrt(r$gen$variance),log=TRUE)),numeric(1))else -n/2*log(t)-sum((out$sample$values-r$gen$mean)^2)/(2*t))
     delta<-log(dd(d,t))-log(dd(p$prior,t))-lp
     # In extreme conflicts evaluate the prior log-kernel directly to avoid underflow.
     pr<-p$prior;logprior<-switch(pr$type,beta=(pr$a-1)*log(t)+(pr$b-1)*log1p(-t),gamma=(pr$a-1)*log(t)-pr$b*t,ig=-(pr$a+1)*log(t)-pr$b/t,normal=dnorm(t,pr$m,sqrt(pr$v),log=TRUE))
     delta<-log(dd(d,t))-logprior-lp;stopifnot(diff(range(delta))<1e-5)
    }
   }
   baseline<-simulate(model,r$gen,r$seed)[seq_len(n)];stopifnot(identical(unname(out$sample$values),unname(baseline)))
   results[[id]]<-list(status='pass',panels=length(out$panels));cases[[length(cases)+1]]<-list(request=r,result=out)
 },error=function(e){failures<<-c(failures,paste(id,conditionMessage(e)));results[[id]]<<-list(status='fail',message=conditionMessage(e))})
}
writeLines(encode_json(results),'artifacts/stress-audit.json')
writeLines(encode_json(cases),'artifacts/stress-fixtures.json')
cat(length(results),'scenarios;',length(failures),'failed\n');if(length(failures)){cat(paste(failures,collapse='\n'));stop('Audit failed')}
