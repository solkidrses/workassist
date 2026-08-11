import paramiko

ORIGINAL_CONFIG = r'''server {
    server_name zexcore.biz;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/zexcore.biz/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/zexcore.biz/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = zexcore.biz) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name zexcore.biz;
    return 404; # managed by Certbot
}
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.56.52.159', username='root', password='jevz2vpTdbPsMuV', timeout=15)

sftp = ssh.open_sftp()
with sftp.open('/etc/nginx/sites-enabled/workassist', 'w') as f:
    f.write(ORIGINAL_CONFIG)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('nginx -t 2>&1 && systemctl reload nginx')
print(stdout.read().decode() + stderr.read().decode())
print("Nginx restored to original")

ssh.close()
