source("research-pipeline/engine.R")
count<-0
check<-function(value,label){if(!isTRUE(value))stop(label);count<<-count+1}
near<-function(a,b,label,tol=1e-8)check(isTRUE(all.equal(a,b,tolerance=tol,check.attributes=FALSE)),label)
req<-function(model="bernoulli",mode="unknown",family="conjugate",n=20)list(model=model,mode=mode,n=n,seed=2026,level=.95,scale="variance",gen=list(p=.4,m=10,rate=2,shape=3,mean=5,variance=30,scale=2),prior=list(family=family,a=2,b=3,m=0,v=10,k=1))
x<-c(rep(1,6),rep(0,14));r<-run_request(req(),x);p<-r$panels[[1]]$posterior
near(c(p$a,p$b),c(8,17),"Beta-Bernoulli update")
b<-req("binomial");b$gen$m<-1;near(run_request(b,x)$panels[[1]]$summary$mean$value,r$panels[[1]]$summary$mean$value,"Bernoulli equals binomial m=1")
x<-seq(.1,2,length.out=20)
e<-req("exponential");g<-req("gamma");g$gen$shape<-1
near(run_request(e,x)$panels[[1]]$posterior,run_request(g,x)$panels[[1]]$posterior,"Exponential equals gamma shape 1")
near(run_request(req("geometric"),rep(2,20))$panels[[1]]$posterior$a,22,"Geometric successes count observations")
near(run_request(req("geometric"),rep(2,20))$panels[[1]]$posterior$b,43,"Geometric failures sum")
near(run_request(req("poisson"),rep(3,20))$panels[[1]]$posterior$a,62,"Poisson update")
near(run_request(req("rayleigh"),x)$panels[[1]]$posterior$b,3+sum(x^2)/2,"Rayleigh factor 1/2")
normal<-req("normal","mean");z<-run_request(normal,rep(4,20))$panels[[1]]
near(z$posterior$v,1/(.1+20/30),"Normal known variance")
normal$mode<-"variance";z<-run_request(normal,rep(4,20))$panels[[1]]
near(c(z$posterior$a,z$posterior$b),c(12,13),"Normal known mean")
normal$mode<-"both";z<-run_request(normal,seq(1,20))$panels
near(z[[1]]$posterior$m,210/21,"NIG mean")
near(z[[2]]$posterior$a,12,"NIG variance shape")
near(z[[2]]$posterior$b,3+sum((seq(1,20)-10.5)^2)/2+20/42*10.5^2,"NIG scale")
for(model in c("bernoulli","binomial","geometric","poisson","normal","exponential","gamma","rayleigh")){
 for(reference in c(FALSE,TRUE)){
  q<-req(model,if(model=="normal")"both" else "unknown",if(reference)"reference" else "conjugate")
  out<-run_request(q);check(out$status=="posterior",paste(model,reference,"proper"))
  for(panel in out$panels){d<-panel$posterior;ci<-panel$summary$interval
   cdf<-function(t)switch(d$type,beta=pbeta(t,d$a,d$b),gamma=pgamma(t,d$a,rate=d$b),ig=1-pgamma(1/t,d$a,rate=d$b),student=pt((t-d$m)/sqrt(d$v),d$df),normal=pnorm(t,d$m,sqrt(d$v)))
   near(cdf(ci$upper)-cdf(ci$lower),.95,paste(model,"interval mass"))
   near(integrate(function(t)dd(d,t),if(d$type%in%c("normal","student"))-Inf else 0,if(d$type=="beta")1 else Inf)$value,1,paste(model,"normalization"),tol=1e-6)
  }
 }
}
for(model in c("bernoulli","binomial"))for(value in c(0,1))check(run_request(req(model),rep(value,20))$status=="posterior","all successes or failures")
check(run_request(req("poisson",family="reference"),rep(0,20))$status=="posterior","Poisson zero counts reference")
check(run_request(req("normal","both","reference"),rep(5,20))$status=="improper","constant Normal joint reference")
check(run_request(req("normal","variance","reference"),rep(5,20))$status=="improper","constant Normal known mean reference")
check(is.null(summarize_distribution(distribution("ig",.7,2),.95)$mean$value),"IG undefined mean")
check(summarize_distribution(distribution("beta",1,1),.95)$mode$status=="all_values","Uniform nonunique mode")
check(summarize_distribution(distribution("beta",.5,.5),.95)$mode$status=="boundary_multiple","Beta two boundary modes")
d<-distribution("sqrtig",4,3);s<-summarize_distribution(d,.95)
near(s$mean$value,integrate(function(t)t*dd(d,t),0,Inf)$value,"Transformed Rayleigh mean")
near(s$mode$values,sqrt(6/9),"Transformed Rayleigh mode")
near(dq(d,.5),sqrt(dq(distribution("ig",4,3),.5)),"Transformed Rayleigh median")
q<-req();q$n<-100;a<-run_request(q)$sample$values;q$n<-20;b<-run_request(q)$sample$values
near(a[1:20],b,"nested sample prefixes",tol=0)
q$prior$a<-100;near(run_request(q)$sample$values,b,"prior preserves observations",tol=0)
q$level<-.8;near(run_request(q)$sample$values,b,"level preserves observations",tol=0)
near(run_request(q)$sample$variance,var(b),"sample variance n-1")
check(grepl('"panels":',run_json(req()),fixed=TRUE),"JSON result serialized")
bad<-req();bad$prior$a<--1;check(grepl('"status":"error"',run_json(bad),fixed=TRUE),"Invalid hyperparameters error")
q<-req('normal','variance');q$prior$a<-.001;q$prior$b<-.001
out<-run_request(q)
check(out$status=='posterior','Heavy-tailed proper prior must not hide valid posterior')
check(nzchar(out$panels[[1]]$plot_note),'Numerical prior tail truncation disclosed')
q<-req('normal','mean');q$prior$m<--100;q$prior$v<-.0001
out<-run_request(q);p<-out$panels[[1]]
check(min(p$prior_curve$x)<=min(p$focus)&&max(p$prior_curve$x)>=max(p$focus),'Prior evaluated across posterior viewport')
q$prior$family<-'reference';out<-run_request(q);p<-out$panels[[1]]
check(p$expanded[1]<=p$truth&&p$expanded[2]>=p$truth,'Expanded reference view includes truth')
cat(count,"statistical checks passed.\n")
