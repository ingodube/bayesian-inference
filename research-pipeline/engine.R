# Bayesian Prior Lab statistical kernel. Runtime dependencies: base and stats only.
# Gamma: shape/rate. Inverse-Gamma: b^a/Gamma(a) v^(-a-1) exp(-b/v).
scalar <- function(x, name, lower=-Inf, upper=Inf, integer=FALSE) {
  if (!is.numeric(x) || length(x)!=1L || !is.finite(x) || x<lower || x>upper ||
      (integer && x!=floor(x))) stop(paste("Invalid", name), call.=FALSE)
  as.numeric(x)
}
positive <- function(x, name) { x <- scalar(x,name); if(x<=0) stop(paste(name,"must be positive"),call.=FALSE); x }
distribution <- function(type, a=NA_real_, b=NA_real_, m=0, v=1, df=NA_real_) list(type=type,a=a,b=b,m=m,v=v,df=df)
dq <- function(d,p) switch(d$type,
  beta=qbeta(p,d$a,d$b), gamma=qgamma(p,d$a,rate=d$b),
  ig=1/qgamma(1-p,d$a,rate=d$b), sqrtig=sqrt(1/qgamma(1-p,d$a,rate=d$b)),
  normal=qnorm(p,d$m,sqrt(d$v)), student=d$m+sqrt(d$v)*qt(p,d$df))
dd <- function(d,x) switch(d$type,
  beta=dbeta(x,d$a,d$b), gamma=dgamma(x,d$a,rate=d$b),
  ig=exp(d$a*log(d$b)-lgamma(d$a)-(d$a+1)*log(x)-d$b/x),
  sqrtig=exp(log(2)+d$a*log(d$b)-lgamma(d$a)-(2*d$a+1)*log(x)-d$b/x^2),
  normal=dnorm(x,d$m,sqrt(d$v)), student=dt((x-d$m)/sqrt(d$v),d$df)/sqrt(d$v))
moment <- function(value, status="finite", reason="") {
  if(is.infinite(value)) return(list(value=NULL,status="numerical_limit",reason="The value exceeds numerical precision."))
  if(!is.finite(value)) return(list(value=NULL,status="undefined",reason=reason))
  list(value=value,status=status,reason="")
}
summarize_distribution <- function(d,level,strict=TRUE) {
  mean <- switch(d$type,beta=d$a/(d$a+d$b),gamma=d$a/d$b,
    ig=if(d$a>1) d$b/(d$a-1) else NA_real_,
    sqrtig=if(d$a>0.5) exp(0.5*log(d$b)+lgamma(d$a-0.5)-lgamma(d$a)) else NA_real_,
    normal=d$m,student=if(d$df>1) d$m else NA_real_)
  variance <- switch(d$type,beta=d$a*d$b/((d$a+d$b)^2*(d$a+d$b+1)),gamma=d$a/d$b^2,
    ig=if(d$a>2) d$b^2/((d$a-1)^2*(d$a-2)) else NA_real_,
    sqrtig=if(d$a>1) d$b/(d$a-1)-mean^2 else NA_real_,normal=d$v,
    student=if(d$df>2) d$v*d$df/(d$df-2) else NA_real_)
  mode_status <- "finite"; modes <- numeric()
  if(d$type=="beta") {
    if(d$a==1 && d$b==1) mode_status <- "all_values"
    else if(d$a<1 && d$b<1) { modes<-c(0,1); mode_status<-"boundary_multiple" }
    else if(d$a<=1) {modes<-0;mode_status<-"boundary"}
    else if(d$b<=1) {modes<-1;mode_status<-"boundary"}
    else modes<-(d$a-1)/(d$a+d$b-2)
  } else if(d$type=="gamma") {
    modes<-max(0,(d$a-1)/d$b); if(d$a<=1) mode_status<-"boundary"
  } else modes<-switch(d$type,ig=d$b/(d$a+1),sqrtig=sqrt(2*d$b/(2*d$a+1)),normal=d$m,student=d$m)
  ci<-dq(d,c((1-level)/2,(1+level)/2))
  if(strict && any(!is.finite(ci)))stop("Credible limits exceed numerical precision. Use less extreme hyperparameters.")
  list(mean=moment(mean,reason="The mean does not exist for these parameters."),
       median=moment(dq(d,0.5)),variance=moment(variance,reason="The variance is not finite for these parameters."),
       mode=list(values=unname(modes),status=mode_status),interval=list(lower=ci[1],upper=ci[2],width=diff(ci),level=level,method="equal_tailed",status=if(all(is.finite(ci)))"finite" else "numerical_limit"))
}
curve <- function(d, extra=numeric()) {
  p<-sort(unique(c(seq(0.0005,0.9995,length.out=401),seq(0.01,0.99,length.out=250))))
  quantiles<-dq(d,p); finite<-quantiles[is.finite(quantiles)]
  if(length(finite)<2)finite<-sort(unique(c(finite,extra[is.finite(extra)])))
  if(length(finite)<2)stop("Distribution cannot be plotted at numerical precision.")
  bounds<-range(finite); x<-sort(unique(c(finite,seq(bounds[1],bounds[2],length.out=301),extra[is.finite(extra)])))
  if(d$type %in% c("ig","sqrtig","gamma")) x<-x[x>0]
  if(d$type=="beta") x<-x[x>0 & x<1]
  y<-dd(d,x); ok<-is.finite(x)&is.finite(y)
  list(x=unname(x[ok]),y=unname(y[ok]))
}
simulate <- function(model,g,seed) {
  RNGkind("Mersenne-Twister","Inversion","Rejection"); set.seed(seed)
  switch(model,bernoulli=rbinom(2500,1,g$p),binomial=rbinom(2500,g$m,g$p),
    geometric=rgeom(2500,g$p),poisson=rpois(2500,g$rate),normal=rnorm(2500,g$mean,sqrt(g$variance)),
    exponential=rexp(2500,g$rate),gamma=rgamma(2500,g$shape,rate=g$rate),
    rayleigh=sqrt(-2*g$scale^2*log1p(-runif(2500))))
}
validate_request <- function(r) {
  if(!r$model %in% c("bernoulli","binomial","geometric","poisson","normal","exponential","gamma","rayleigh")) stop("Choose a valid likelihood.")
  scalar(r$n,"sample size",20,2500,TRUE); if(!r$n %in% c(20,100,500,1000,2500)) stop("Unsupported sample size.")
  scalar(r$seed,"seed",0,2147483646,TRUE); scalar(r$level,"credible level",0.50,0.99)
  g<-r$gen
  if(r$model %in% c("bernoulli","binomial","geometric")) {
    scalar(g$p,"generating probability",0,1); if(r$model=="geometric" && g$p==0) stop("Geometric probability must be positive.")
  }
  if(r$model=="binomial") scalar(g$m,"trials per observation",1,100000,TRUE)
  if(r$model %in% c("poisson","exponential","gamma")) positive(g$rate,"Generating rate")
  if(r$model=="gamma") positive(g$shape,"Known shape")
  if(r$model=="rayleigh") positive(g$scale,"Generating scale")
  if(r$model=="normal") {scalar(g$mean,"generating mean");positive(g$variance,"Generating variance")}
  if(r$model=="normal" && !r$mode %in% c("mean","variance","both","known")) stop("Declare which Normal parameters are known.")
  if(r$model!="normal" && !r$mode %in% c("unknown","known")) stop("Declare which parameters are known.")
  invisible(r)
}
observed_plot <- function(model,g,x) {
  discrete<-model %in% c("bernoulli","binomial","geometric","poisson")
  if(discrete && diff(range(x))<=100) {
    bx<-seq(min(x),max(x)); by<-tabulate(match(x,bx),length(bx))/length(x); widths<-rep(0.82,length(bx))
    upper<-if(model=="bernoulli")1 else if(model=="binomial")g$m else if(model=="geometric")qgeom(0.999,g$p) else qpois(0.999,g$rate)
    tx<-if(upper<=150)0:upper else seq(min(x),max(x))
    ty<-switch(model,bernoulli=dbinom(tx,1,g$p),binomial=dbinom(tx,g$m,g$p),geometric=dgeom(tx,g$p),poisson=dpois(tx,g$rate))
    note<-"Bars show observed proportions; markers show generating probabilities."
  } else {
    if(discrete) {
      br<-seq(floor(min(x))-0.5,ceiling(max(x))+0.5,length.out=41)
      h<-hist(x,breaks=br,plot=FALSE); widths<-diff(h$breaks);bx<-h$mids;by<-h$counts/length(x)/widths
      cdf<-function(z) switch(model,binomial=pbinom(z,g$m,g$p),geometric=pgeom(z,g$p),poisson=ppois(z,g$rate))
      tx<-bx;ty<-(cdf(floor(h$breaks[-1]))-cdf(floor(h$breaks[-length(h$breaks)])))/widths
      note<-"Integer values are grouped. Heights are probability per unit; generating masses use the same bins."
    } else {
      h<-hist(x,breaks="FD",plot=FALSE); bx<-h$mids;by<-h$density;widths<-diff(h$breaks)
      tx<-seq(min(h$breaks),max(h$breaks),length.out=501)
      ty<-switch(model,normal=dnorm(tx,g$mean,sqrt(g$variance)),exponential=dexp(tx,g$rate),gamma=dgamma(tx,g$shape,rate=g$rate),rayleigh=ifelse(tx>=0,tx/g$scale^2*exp(-tx^2/(2*g$scale^2)),0))
      note<-"Histogram area is one. The line is the generating density, not a posterior."
    }
  }
  good<-is.finite(ty)
  list(x=unname(bx),y=unname(by),width=unname(widths),theory_x=unname(tx[good]),theory_y=unname(ty[good]),discrete=discrete,note=note)
}
posterior_models <- function(r,x) {
  n<-length(x);S<-sum(x);g<-r$gen;h<-r$prior;ref<-identical(h$family,"reference");p<-NULL;post<-NULL
  if(!h$family %in% c("reference","conjugate")) stop("Choose a compatible prior.")
  if(!ref) {
    if(r$model=="normal" && r$mode=="mean") {scalar(h$m,"prior mean");positive(h$v,"Prior variance")}
    else {positive(h$a,"Prior shape a");positive(h$b,"Prior rate or scale b")}
    if(r$model=="normal" && r$mode=="both") {scalar(h$m,"prior location");positive(h$k,"Prior strength kappa")}
  }
  a<-if(ref) 0 else h$a;b<-if(ref) 0 else h$b
  target<-"";truth<-0;prior_note<-"";formula<-""
  if(r$model %in% c("bernoulli","binomial","geometric")) {
    if(ref) {a<-if(r$model=="geometric") 0 else 0.5;b<-0.5}
    post<-if(r$model=="geometric") distribution("beta",a+n,b+S) else distribution("beta",a+S,b+n*(if(r$model=="binomial")g$m else 1)-S)
    if(!ref || r$model!="geometric") p<-distribution("beta",a,b)
    target<-"Success probability p";truth<-g$p
    formula<-if(r$model=="geometric") "a' = a + n; b' = b + sum(x)" else "a' = a + successes; b' = b + failures"
    if(ref) prior_note<-if(r$model=="geometric") "Improper Jeffreys reference: p^(-1) (1-p)^(-1/2). No normalized prior density." else "Jeffreys prior: Beta(1/2, 1/2), a proper distribution."
  } else if(r$model %in% c("poisson","exponential","gamma")) {
    if(ref && r$model=="poisson") a<-0.5
    post<-if(r$model=="poisson") distribution("gamma",a+S,b+n) else distribution("gamma",a+n*(if(r$model=="gamma")g$shape else 1),b+S)
    if(!ref)p<-distribution("gamma",a,b)
    target<-"Rate lambda";truth<-g$rate
    formula<-if(r$model=="poisson") "a' = a + sum(x); b' = b + n" else if(r$model=="gamma") "a' = a + n*k; b' = b + sum(x)" else "a' = a + n; b' = b + sum(x)"
    if(ref) prior_note<-if(r$model=="poisson") "Improper Jeffreys reference: lambda^(-1/2). No normalized prior density." else "Improper reference: 1/lambda. No normalized prior density."
  } else if(r$model=="rayleigh") {
    post<-distribution("ig",a+n,b+sum(x^2)/2);if(!ref)p<-distribution("ig",a,b)
    if(identical(r$scale,"sigma")) {post$type<-"sqrtig";if(!is.null(p))p$type<-"sqrtig"}
    target<-if(post$type=="sqrtig") "Rayleigh scale sigma" else "Squared Rayleigh scale sigma^2"
    truth<-if(post$type=="sqrtig")g$scale else g$scale^2
    formula<-"a' = a + n; b' = b + sum(x^2)/2, on sigma^2"
    if(ref)prior_note<-"Improper reference on v = sigma^2: 1/v. No normalized prior density."
  } else if(r$mode=="mean") {
    vn<-if(ref)g$variance/n else 1/(1/h$v+n/g$variance)
    mn<-if(ref)mean(x) else vn*(h$m/h$v+sum(x)/g$variance)
    post<-distribution("normal",m=mn,v=vn);if(!ref)p<-distribution("normal",m=h$m,v=h$v)
    target<-"Normal mean mu";truth<-g$mean;formula<-"V' = 1/(1/V0 + n/sigma^2); m' = V'*(m0/V0 + sum(x)/sigma^2)"
    if(ref)prior_note<-"Improper flat reference for mu. No normalized prior density."
  } else if(r$mode=="variance") {
    post<-distribution("ig",a+n/2,b+sum((x-g$mean)^2)/2);if(!ref)p<-distribution("ig",a,b)
    target<-"Normal variance sigma^2";truth<-g$variance;formula<-"a' = a + n/2; b' = b + sum((x-mu)^2)/2"
    if(ref)prior_note<-"Improper reference for v = sigma^2: 1/v. No normalized prior density."
  } else {
    if(ref) {an<-(n-1)/2;bn<-sum((x-mean(x))^2)/2;kn<-n;mn<-mean(x)}
    else {kn<-h$k+n;mn<-(h$k*h$m+S)/kn;an<-a+n/2;bn<-b+sum((x-mean(x))^2)/2+h$k*n/(2*kn)*(mean(x)-h$m)^2}
    pd<-distribution("ig",an,bn)
    md<-distribution("student",m=mn,v=bn/(an*kn),df=2*an)
    pp<-if(ref)NULL else distribution("ig",a,b)
    pm<-if(ref)NULL else distribution("student",m=h$m,v=b/(a*h$k),df=2*a)
    note<-if(ref) "Improper joint reference p(mu,v) proportional to 1/v; this is not joint Jeffreys. No normalized prior marginals." else "A joint Normal-Inverse-Gamma prior; mu and variance are not independent. Intervals below are marginal, not a joint credible region."
    return(list(items=list(list(prior=pm,posterior=md,target="Normal mean mu",truth=g$mean),list(prior=pp,posterior=pd,target="Normal variance sigma^2",truth=g$variance)),note=note,formula=if(ref) "Reference p(mu,v) proportional to 1/v: v|x ~ IG((n-1)/2, SSE/2); mu|x ~ t(n-1, xbar, s/sqrt(n))" else "k' = k+n; m' = (k*m0+n*xbar)/k'; a' = a+n/2; b' = b+SSE/2+k*n*(xbar-m0)^2/(2*k')"))
  }
  list(items=list(list(prior=p,posterior=post,target=target,truth=truth)),note=prior_note,formula=formula)
}
is_proper <- function(d) {
  if(d$type %in% c("beta","gamma","ig","sqrtig")) return(is.finite(d$a)&&is.finite(d$b)&&d$a>0&&d$b>0)
  is.finite(d$v)&&d$v>0&&(d$type!="student"||d$df>0)
}
run_request <- function(r, observations=NULL) {
  validate_request(r)
  sequence<-if(is.null(observations)) simulate(r$model,r$gen,r$seed) else observations
  if(length(sequence)<r$n || any(!is.finite(sequence)))stop("Simulation exceeded numerical limits. Use less extreme parameters.")
  x<-sequence[seq_len(r$n)]
  if(any(!is.finite(c(mean(x),var(x),sum(x),sum(x^2)))))stop("Sample summaries exceed numerical precision. Use less extreme generating parameters.")
  result<-list(schema_version=1,request=r,sample=list(values=unname(x),n=length(x),mean=mean(x),variance=var(x),sum=sum(x),sum_squares=sum(x^2),rng="Mersenne-Twister / Inversion / Rejection",r_version=as.character(getRversion())),observed=observed_plot(r$model,r$gen,x),panels=list(),note="",formula="",status="sample")
  if(r$mode=="known" || is.null(r$prior) || identical(r$prior$family,""))return(result)
  mods<-posterior_models(r,x)
  if(!all(vapply(mods$items,function(z)is_proper(z$posterior),logical(1)))) {
    result$status<-"improper";result$note<-"This reference prior and these data do not produce a proper posterior. Estimates and credible intervals are unavailable.";return(result)
  }
  result$panels<-lapply(mods$items,function(z) {
    summary<-summarize_distribution(z$posterior,r$level);pc<-curve(z$posterior,c(summary$interval$lower,summary$interval$upper,summary$median$value))
    mask<-pc$x>=summary$interval$lower & pc$x<=summary$interval$upper
    bounds<-dq(z$posterior,c(0.001,0.999));prior_summary<-if(is.null(z$prior))NULL else summarize_distribution(z$prior,r$level,strict=FALSE)
    prior_bounds<-if(is.null(z$prior))numeric() else dq(z$prior,c(0.001,0.999))
    plot_note<-if(any(!is.finite(prior_bounds)))"The prior has tails beyond numerical plotting precision. The posterior remains valid; unavailable prior limits are marked below." else ""
    expanded<-range(c(bounds,prior_bounds[is.finite(prior_bounds)],z$truth,summary$mode$values))
    # Evaluate both densities across the displayed domain, including near the other peak.
    domain<-seq(expanded[1],expanded[2],length.out=401)
    prior_curve<-if(is.null(z$prior))NULL else curve(z$prior,c(pc$x,domain))
    pc<-curve(z$posterior,c(pc$x,domain,if(is.null(prior_curve))numeric() else prior_curve$x))
    mask<-pc$x>=summary$interval$lower & pc$x<=summary$interval$upper
    list(target=z$target,truth=z$truth,posterior=z$posterior,prior=z$prior,summary=summary,prior_summary=prior_summary,curve=pc,prior_curve=prior_curve,shade=list(x=pc$x[mask],y=pc$y[mask]),focus=unname(bounds),expanded=unname(expanded),plot_note=plot_note,boundary_note=if(z$posterior$type=="beta" || z$posterior$type=="gamma") "Boundary modes may be limiting maxima. Infinite endpoint densities are not drawn." else "")
  })
  result$status<-"posterior";result$note<-mods$note;result$formula<-mods$formula;result
}
# Small JSON encoder keeps the browser engine free of downloaded R packages.
# Only engine-created lists, numeric vectors, booleans and strings are serialized.
encode_json <- function(x) {
  quote_string<-function(s) {
    s<-gsub("\\", "\\\\",s,fixed=TRUE);s<-gsub('"','\\"',s,fixed=TRUE)
    s<-gsub("\n","\\n",s,fixed=TRUE);s<-gsub("\r","\\r",s,fixed=TRUE);s<-gsub("\t","\\t",s,fixed=TRUE)
    paste0('"',s,'"')
  }
  if(is.null(x))return("null")
  if(is.list(x)) {
    if(!is.null(names(x))) return(paste0("{",paste(paste0(vapply(names(x),quote_string,character(1)),":",vapply(x,encode_json,character(1))),collapse=","),"}"))
    return(paste0("[",paste(vapply(x,encode_json,character(1)),collapse=","),"]"))
  }
  if(length(x)!=1L)return(paste0("[",paste(vapply(as.list(x),encode_json,character(1)),collapse=","),"]"))
  if(is.na(x))return("null")
  if(is.character(x))return(quote_string(x))
  if(is.logical(x))return(if(x)"true" else "false")
  if(!is.finite(x))return("null")
  sprintf("%.17g",x)
}
run_json <- function(request) tryCatch(encode_json(run_request(request)),error=function(e)encode_json(list(status="error",message=conditionMessage(e))))
