module.exports=[2246,a=>{"use strict";var b=a.i(87924),c=a.i(72131),d=a.i(50944),e=a.i(95445);let f=["01-coffee","02-burger-messy","03-golf-glove","04-sunscreen","05-rangefinder","06-hotdog","07-protein-bar","08-driver","09-cheeseburger","11-hamburger","12-water-jug","13-bloody-mary","14-cocktail","15-beer-can"].map(a=>`https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos/default-avatars/${a}.png`);function g(){let a=(0,d.useRouter)(),[g,h]=(0,c.useState)(""),[i,j]=(0,c.useState)(""),[k,l]=(0,c.useState)(""),[m,n]=(0,c.useState)(!1),[o,p]=(0,c.useState)(""),[q,r]=(0,c.useState)(!1),s=async()=>{if(p(""),n(!0),!g||!i||!k){p("All fields are required."),n(!1);return}if(i.length<8){p("Password must be at least 8 characters."),n(!1);return}if(k.length<3){p("Username must be at least 3 characters."),n(!1);return}let b=(0,e.createClient)(),{data:c,error:d}=await b.auth.signUp({email:g,password:i,options:{data:{username:k,display_name:k}}});if(d){p(d.message),n(!1);return}let h=c.user?.id;if(h){let a=new Date().toISOString(),{error:c}=await b.from("User").insert({id:h,email:g,username:k,displayName:k,avatarUrl:f[Math.floor(Math.random()*f.length)],createdAt:a,updatedAt:a});if(c){p("Account created but profile setup failed. Please contact support."),n(!1);return}fetch("/api/points/award",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"signup"})}).catch(()=>{}),fetch("/api/referral/signup",{method:"POST"}).catch(()=>{})}c.session?a.push("/onboarding"):(r(!0),n(!1))};return(0,b.jsxs)("main",{style:{minHeight:"100dvh",background:"#07100a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"},children:[(0,b.jsx)("style",{children:`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .bg-texture {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .bg-glow {
          position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 500px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(56,140,76,0.12) 0%, transparent 68%);
        }
        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 36px 32px;
        }
        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 24px; font-weight: 900; color: #fff;
          margin-bottom: 6px; display: flex; align-items: center; gap: 10px;
        }
        .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: #4da862; }
        .tagline {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.55); margin-bottom: 28px;
        }
        .title {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 4px;
        }
        .subtitle {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.6); margin-bottom: 24px;
        }
        .field { margin-bottom: 14px; }
        .field-label {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.65); margin-bottom: 7px; display: block;
        }
        .field-input {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.09); border-radius: 12px;
          padding: 13px 16px; font-family: 'Outfit', sans-serif;
          font-size: 14px; color: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.2); }
        .field-input:focus {
          border-color: rgba(77,168,98,0.5);
          box-shadow: 0 0 0 3px rgba(77,168,98,0.08);
        }
        .error-box {
          background: rgba(200,80,80,0.1); border: 1px solid rgba(200,80,80,0.25);
          border-radius: 10px; padding: 10px 14px; margin-bottom: 16px;
          font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(240,120,120,0.9);
        }
        .success-box {
          background: rgba(77,168,98,0.1); border: 1px solid rgba(77,168,98,0.25);
          border-radius: 10px; padding: 16px; text-align: center;
        }
        .success-title {
          font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700;
          color: #fff; margin-bottom: 6px;
        }
        .success-sub {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.65); line-height: 1.6;
        }
        .btn-submit {
          width: 100%; background: #2d7a42; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600;
          color: #fff; padding: 14px; border-radius: 12px; margin-top: 6px;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-submit:hover { background: #256936; }
        .btn-submit:active { transform: scale(0.99); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .divider {
          height: 1px; margin: 22px 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
        }
        .login-link {
          text-align: center; font-family: 'Outfit', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.6);
        }
        .login-link a {
          color: #4da862; text-decoration: none; font-weight: 500;
        }
        .login-link a:hover { text-decoration: underline; }
      `}),(0,b.jsx)("div",{className:"bg-texture"}),(0,b.jsx)("div",{className:"bg-glow"}),(0,b.jsxs)("div",{className:"card",children:[(0,b.jsx)("img",{src:"/tour-it-logo-full.png",alt:"Tour It",style:{height:48,width:"auto",maxWidth:"100%",marginBottom:4}}),(0,b.jsx)("p",{className:"tagline",children:"Scout every hole before you play it."}),(0,b.jsx)("h1",{className:"title",children:"Create your account"}),(0,b.jsx)("p",{className:"subtitle",children:"Join the community. Start scouting."}),o&&(0,b.jsx)("div",{className:"error-box",children:o}),q?(0,b.jsxs)("div",{className:"success-box",children:[(0,b.jsx)("div",{style:{fontSize:32,marginBottom:12},children:"⛳"}),(0,b.jsx)("div",{className:"success-title",children:"Check your email"}),(0,b.jsxs)("p",{className:"success-sub",children:["We sent a confirmation link to ",(0,b.jsx)("strong",{style:{color:"rgba(255,255,255,0.7)"},children:g}),".",(0,b.jsx)("br",{}),"Click it to confirm your account, then come back here and log in."]}),(0,b.jsx)("a",{href:"/login",style:{display:"block",marginTop:20,background:"#2d7a42",border:"none",borderRadius:12,padding:"13px",fontFamily:"'Outfit', sans-serif",fontSize:14,fontWeight:600,color:"#fff",textDecoration:"none",textAlign:"center"},children:"Go to Login →"})]}):(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("div",{className:"field",children:[(0,b.jsx)("label",{className:"field-label",children:"Username"}),(0,b.jsx)("input",{className:"field-input",type:"text",placeholder:"e.g. jgoldstein",value:k,onChange:a=>l(a.target.value.toLowerCase().replace(/\s/g,""))}),(0,b.jsx)("p",{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:5},children:"Lowercase only, no spaces"})]}),(0,b.jsxs)("div",{className:"field",children:[(0,b.jsx)("label",{className:"field-label",children:"Email"}),(0,b.jsx)("input",{className:"field-input",type:"email",placeholder:"you@example.com",value:g,onChange:a=>h(a.target.value)})]}),(0,b.jsxs)("div",{className:"field",children:[(0,b.jsx)("label",{className:"field-label",children:"Password"}),(0,b.jsx)("input",{className:"field-input",type:"password",placeholder:"Min. 8 characters",value:i,onChange:a=>j(a.target.value),onKeyDown:a=>"Enter"===a.key&&s()})]}),(0,b.jsx)("button",{className:"btn-submit",onClick:s,disabled:m,children:m?"Creating account...":"Create account"}),(0,b.jsxs)("div",{style:{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center",lineHeight:1.6,marginTop:4},children:["By creating an account you agree to our"," ",(0,b.jsx)("a",{href:"/terms",style:{color:"rgba(255,255,255,0.5)",textDecoration:"underline"},children:"Terms of Service"})," ","and"," ",(0,b.jsx)("a",{href:"/privacy",style:{color:"rgba(255,255,255,0.5)",textDecoration:"underline"},children:"Privacy Policy"}),"."]}),(0,b.jsx)("div",{className:"divider"}),(0,b.jsxs)("div",{className:"login-link",children:["Already have an account? ",(0,b.jsx)("a",{href:"/login",children:"Log in"})]})]})]})]})}a.s(["default",()=>g])}];

//# sourceMappingURL=src_app_signup_page_tsx_f80fa7a2._.js.map