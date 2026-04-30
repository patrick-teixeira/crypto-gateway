from flask import Flask
from api.routes.auth import auth_app
from api.routes.payment import payment_app

app = Flask(__name__)

# Registrar as rotas do payment
app.register_blueprint(payment_app)
app.register_blueprint(auth_app)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8021, debug=True)
