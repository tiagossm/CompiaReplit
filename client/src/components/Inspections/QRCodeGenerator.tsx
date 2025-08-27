import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Copy, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeGeneratorProps {
  inspectionId: string;
  inspectionTitle: string;
  qrCode?: string;
}

export default function QRCodeGenerator({ inspectionId, inspectionTitle, qrCode }: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>(qrCode || "");
  const [inspectionUrl, setInspectionUrl] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/inspections/${inspectionId}`;
    setInspectionUrl(url);

    // If no QR code provided, we would normally generate one here
    // For now, we'll simulate a QR code data URL
    if (!qrCode) {
      // In a real implementation, this would call an API to generate the QR code
      // For demo purposes, using a placeholder
      const placeholderQR = `data:image/svg+xml;base64,${btoa(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="white"/>
          <rect x="10" y="10" width="180" height="180" fill="none" stroke="#3B82F6" stroke-width="2"/>
          <text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="12" fill="#3B82F6">QR Code</text>
          <text x="100" y="120" text-anchor="middle" font-family="Arial" font-size="10" fill="#666">Inspection ID:</text>
          <text x="100" y="135" text-anchor="middle" font-family="Arial" font-size="8" fill="#666">${inspectionId.slice(0, 8)}</text>
        </svg>
      `)}`;
      setQrCodeUrl(placeholderQR);
    }
  }, [inspectionId, qrCode]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(inspectionUrl);
      toast({
        title: "URL copiada!",
        description: "URL da inspeção copiada para a área de transferência",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a URL",
        variant: "destructive"
      });
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `qr-code-${inspectionId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "QR Code baixado!",
        description: "QR Code salvo na pasta de downloads",
      });
    }
  };

  const shareInspection = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: inspectionTitle,
          text: `Inspeção: ${inspectionTitle}`,
          url: inspectionUrl,
        });
      } catch (error) {
        // User cancelled sharing or share failed
        copyUrl(); // Fallback to copying URL
      }
    } else {
      copyUrl(); // Fallback for browsers without Web Share API
    }
  };

  return (
    <Card data-testid="qr-code-generator">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <QrCode className="w-5 h-5 text-compia-blue" />
          <span>QR Code da Inspeção</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code Display */}
        <div className="flex justify-center" data-testid="qr-code-display">
          {qrCodeUrl ? (
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <img 
                src={qrCodeUrl} 
                alt={`QR Code para ${inspectionTitle}`}
                className="w-48 h-48 object-contain"
                data-testid="qr-code-image"
              />
            </div>
          ) : (
            <div className="w-48 h-48 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <QrCode className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Gerando QR Code...</p>
              </div>
            </div>
          )}
        </div>

        {/* Inspection URL */}
        <div className="space-y-2" data-testid="inspection-url-section">
          <Label htmlFor="inspection-url">URL da Inspeção</Label>
          <div className="flex space-x-2">
            <Input
              id="inspection-url"
              value={inspectionUrl}
              readOnly
              className="flex-1 bg-muted"
              data-testid="inspection-url-input"
            />
            <Button
              onClick={copyUrl}
              variant="outline"
              size="sm"
              className="px-3"
              data-testid="copy-url-button"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-3" data-testid="qr-actions">
          <Button
            onClick={downloadQRCode}
            variant="outline"
            className="flex items-center space-x-2"
            disabled={!qrCodeUrl}
            data-testid="download-qr-button"
          >
            <Download className="w-4 h-4" />
            <span>Baixar QR</span>
          </Button>
          
          <Button
            onClick={shareInspection}
            className="flex items-center space-x-2 bg-compia-blue hover:bg-compia-blue/90"
            data-testid="share-inspection-button"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartilhar</span>
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4" data-testid="qr-instructions">
          <h4 className="font-medium text-foreground mb-2">Como usar:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Escaneie o QR Code com qualquer leitor</li>
            <li>• Compartilhe o QR Code ou URL para acesso direto</li>
            <li>• Use para facilitar o acesso móvel à inspeção</li>
            <li>• QR Code permanece válido enquanto a inspeção existir</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
