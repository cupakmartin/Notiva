from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
bearer=HTTPBearer(auto_error=False)

def get_current_user(token: HTTPAuthorizationCredentials=Depends(bearer)):
    if token and token.credentials:
        return {"sub":"dev"}
    raise HTTPException(status_code=401, detail="Unauthorized")
