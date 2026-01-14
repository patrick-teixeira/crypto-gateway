from flask import Flask
from api.routes.payment import payment_app

app = Flask(__name__)

# Registrar as rotas do payment
app.register_blueprint(payment_app)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8021, debug=True)