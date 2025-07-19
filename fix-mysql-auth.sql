-- Script para corrigir autenticação MySQL
USE mysql;

-- Alterar o plugin de autenticação para o usuário mysql
ALTER USER 'mysql'@'%' IDENTIFIED WITH mysql_native_password BY 'mysql';

-- Alterar o plugin de autenticação para o usuário root
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'mysql';

-- Recarregar privilégios
FLUSH PRIVILEGES;

-- Criar banco se não existir
CREATE DATABASE IF NOT EXISTS business_api;

-- Mostrar usuários
SELECT user, host, plugin FROM user WHERE user IN ('mysql', 'root'); 