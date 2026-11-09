/** Shared optical fabric for the hero's veil and the ribbon travelling through the page. */
export const SILK_FABRIC_GLSL=`
 float silkFabric(float d,float u,float layer,float phase){
  float fabric=exp(-d*d*.85)*(.11+.045*sin(u*9.0-phase+layer));
  float fibers=pow(.5+.5*sin(d*13.0+u*20.0+sin(u*17.0-phase)*1.3+layer),24.0)*exp(-d*d*.7)*.08;
  float crest=exp(-pow((d-sin(u*9.0+phase+layer)*.26)*12.0,2.0))*.28;
  crest*=.3+.7*pow(.5+.5*sin(u*10.0-phase*.6+layer),3.0);
  float folds=.35+.65*pow(.5+.5*sin(u*15.0-phase+layer),2.0);
  return (fabric+fibers+crest)*folds/(1.0+layer*.45);
 }
`;
